// Runs a candidate's coding answer against test cases, in a sandbox.
//
// JavaScript / TypeScript: QuickJS compiled to WebAssembly, in-process. The
// candidate's code gets no access to the host (no process, require, fetch,
// file system), a memory cap and a wall-clock deadline. Works anywhere the app
// runs, including serverless.
// Python: a Piston code-execution server (CODE_RUNNER_URL), which isolates each
// run in its own sandbox with no network. Without it, Python is not offered.
// Run Piston with PISTON_OUTPUT_MAX_SIZE=1048576: its default (1024 chars) is
// smaller than the results of the larger hidden tests, and the sandbox then
// aborts ("Sandbox keeper received fatal signal 6") on CORRECT code.
//
// Every test is a fresh program; a test's calls run in order on that program,
// so stateful tasks (a rate limiter) are testable. Results are compared HERE,
// on the host, never inside the sandbox, so candidate code cannot mark itself
// correct.

import { newQuickJSWASMModule, shouldInterruptAfterDeadline } from 'quickjs-emscripten'
import { transform } from 'sucrase'
import { randomBytes } from 'node:crypto'

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const MAX_LOG_LINES = 50
const MAX_LOG_CHARS = 4000

let quickjsPromise = null
function quickjs() {
  if (!quickjsPromise) quickjsPromise = newQuickJSWASMModule()
  return quickjsPromise
}

export function runnerAvailable(language) {
  if (language === 'javascript' || language === 'typescript') return true
  if (language === 'python') return Boolean(process.env.CODE_RUNNER_URL)
  return false
}

export function availableLanguages() {
  return ['javascript', 'typescript', 'python'].filter(runnerAvailable)
}

// ── Comparison ────────────────────────────────────────────────────────────

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

function floatEqual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-6
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => floatEqual(x, b[i]))
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort()
    const kb = Object.keys(b).sort()
    return canonical(ka) === canonical(kb) && ka.every((k) => floatEqual(a[k], b[k]))
  }
  return a === b
}

export function resultsMatch(expected, actual, mode = 'exact') {
  if (mode === 'float') return floatEqual(expected, actual)
  if (mode === 'unordered' && Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return false
    const e = expected.map(canonical).sort()
    const a = actual.map(canonical).sort()
    return e.every((x, i) => x === a[i])
  }
  return canonical(expected) === canonical(actual)
}

// ── JavaScript / TypeScript (QuickJS) ─────────────────────────────────────

function prepareJs(language, code) {
  // `imports` lets candidates write `export function ...`; `typescript` strips
  // type annotations. Neither changes behaviour.
  const transforms = language === 'typescript' ? ['typescript', 'imports'] : ['imports']
  return transform(code, { transforms, production: true }).code
}

const JS_PRELUDE = `
var module = { exports: {} }; var exports = module.exports;
var __logs = [];
var __fmt = function (x) { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch (e) { return String(x); } };
var console = { log: function () { if (__logs.length < ${MAX_LOG_LINES}) __logs.push(Array.prototype.map.call(arguments, __fmt).join(' ')); } };
console.error = console.log; console.warn = console.log; console.info = console.log;
`

async function runJsTest(QuickJS, compiled, fnName, test, timeoutMs) {
  const rt = QuickJS.newRuntime()
  rt.setMemoryLimit(64 * 1024 * 1024)
  rt.setMaxStackSize(1024 * 1024)
  rt.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs))
  const ctx = rt.newContext()
  const evalJson = (src, filename) => {
    const r = ctx.evalCode(src, filename)
    if (r.error) {
      const err = ctx.dump(r.error)
      r.error.dispose()
      const msg = err && typeof err === 'object' ? `${err.name || 'Error'}: ${err.message || ''}` : String(err)
      throw new Error(msg)
    }
    const v = ctx.dump(r.value)
    r.value.dispose()
    return v
  }
  const out = { actual: [], logs: [] }
  try {
    evalJson(JS_PRELUDE, 'prelude.js')
    evalJson(compiled, 'solution.js')
    evalJson(
      `var __fn = (typeof ${fnName} === 'function') ? ${fnName} : (module.exports && module.exports.${fnName});
       if (typeof __fn !== 'function') throw new Error('function ${fnName} was not found');`,
      'harness.js'
    )
    for (const call of test.calls) {
      const json = evalJson(`JSON.stringify(__fn.apply(null, ${JSON.stringify(call.args)}))`, 'harness.js')
      out.actual.push(json === undefined ? undefined : JSON.parse(json))
    }
  } catch (e) {
    out.error = /interrupted/.test(e.message) ? 'Time limit exceeded' : e.message
  } finally {
    try { out.logs = evalJson('__logs', 'harness.js') || [] } catch { out.logs = [] }
    ctx.dispose()
    rt.dispose()
  }
  return out
}

// ── Python (Piston) ───────────────────────────────────────────────────────

function pythonProgram(code, fnName, calls, marker) {
  return `import json as __json, sys as __sys
__SRC = ${JSON.stringify(code)}
__CALLS = __json.loads(${JSON.stringify(JSON.stringify(calls.map((c) => c.args)))})
__out = {"actual": []}
try:
    __ns = {"__name__": "solution"}
    exec(compile(__SRC, "solution.py", "exec"), __ns)
    __f = __ns.get(${JSON.stringify(fnName)})
    if not callable(__f):
        raise NameError("function ${fnName} was not found")
    for __args in __CALLS:
        __out["actual"].append(__json.loads(__json.dumps(__f(*__args))))
except BaseException as __e:
    __out["error"] = type(__e).__name__ + ": " + str(__e)[:300]
__sys.stdout.flush()
print("\\n" + ${JSON.stringify(marker)} + __json.dumps(__out), flush=True)
`
}

async function runPythonTest(code, fnName, test, timeoutMs) {
  const marker = `@@RESULT-${randomBytes(12).toString('hex')}@@`
  const res = await fetch(`${process.env.CODE_RUNNER_URL.replace(/\/$/, '')}/api/v2/execute`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      language: 'python',
      version: process.env.CODE_RUNNER_PYTHON_VERSION || '3.12.0',
      files: [{ name: 'main.py', content: pythonProgram(code, fnName, test.calls, marker) }],
      run_timeout: timeoutMs,
      run_memory_limit: 128 * 1024 * 1024,
    }),
    signal: AbortSignal.timeout(timeoutMs + 15000),
  })
  if (!res.ok) throw Object.assign(new Error(`code runner HTTP ${res.status}`), { infra: true })
  const data = await res.json()
  const run = data.run || {}
  const stdout = String(run.stdout || '')
  const at = stdout.lastIndexOf(marker)
  if (at === -1) {
    const timedOut = run.status === 'TO' || /time limit/i.test(run.message || '')
    return {
      actual: [],
      logs: stdout.split('\n').filter(Boolean).slice(0, MAX_LOG_LINES),
      error: timedOut ? 'Time limit exceeded' : (String(run.stderr || run.message || 'program stopped').trim().split('\n').slice(-1)[0]),
    }
  }
  const parsed = JSON.parse(stdout.slice(at + marker.length).trim())
  return {
    actual: parsed.actual || [],
    error: parsed.error,
    logs: stdout.slice(0, at).split('\n').filter(Boolean).slice(0, MAX_LOG_LINES),
  }
}

// ── Public entry ──────────────────────────────────────────────────────────

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}

// tests: [{ name, calls: [{ args, expected }] }]
// Returns { passed, total, results: [{ name, passed, error, logs, actual }], infraError }.
// `actual` is returned so callers can show it for VISIBLE tests only.
export async function runTests({ language, code, functionName, tests, compare = 'exact', timeoutMs = 3000 }) {
  const itemLanguage = language === 'python' ? 'python' : 'javascript'
  const fnName = functionName?.[itemLanguage]
  if (!fnName || !IDENT.test(fnName)) throw new Error('invalid function name for this task')
  if (!runnerAvailable(language)) throw Object.assign(new Error(`no runner for ${language}`), { infra: true })

  let runOne
  if (itemLanguage === 'javascript') {
    let compiled
    try {
      compiled = prepareJs(language, String(code || ''))
    } catch (e) {
      const msg = `SyntaxError: ${String(e.message || e).split('\n')[0]}`
      return {
        passed: 0, total: tests.length,
        results: tests.map((t) => ({ name: t.name, passed: false, error: msg, logs: [] })),
      }
    }
    const QuickJS = await quickjs()
    runOne = (t) => runJsTest(QuickJS, compiled, fnName, t, timeoutMs)
  } else {
    runOne = (t) => runPythonTest(String(code || ''), fnName, t, timeoutMs)
  }

  try {
    const raw = await mapLimit(tests, itemLanguage === 'python' ? 4 : 1, runOne)
    const results = raw.map((r, i) => {
      const t = tests[i]
      const ok = !r.error && r.actual.length === t.calls.length &&
        t.calls.every((c, k) => resultsMatch(c.expected, r.actual[k], compare))
      const logs = []
      let chars = 0
      for (const line of r.logs || []) {
        chars += line.length
        if (chars > MAX_LOG_CHARS) break
        logs.push(line)
      }
      return { name: t.name, passed: ok, error: r.error || null, logs, actual: r.actual }
    })
    return { passed: results.filter((r) => r.passed).length, total: tests.length, results }
  } catch (e) {
    if (e.infra || e.name === 'TimeoutError' || /fetch failed|ECONNREFUSED/i.test(e.message)) {
      return { passed: 0, total: tests.length, results: [], infraError: e.message }
    }
    throw e
  }
}
