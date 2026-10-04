# Question banks

Each JSON file in `frameworks/banks/<family>/<track>-<level>/` is an array of items.
`scripts/validate-assessment-bank.mjs` checks every file mechanically. That includes running
every coding task's reference and wrong solutions in the real sandbox, and running every
code-output snippet to confirm the keyed answer. `scripts/seed-assessment-bank.mjs` loads
validated items into the `items` table (upsert by `bank_key`).

Design: `frameworks/swe-assessment-design.md`.

## Fields shared by every item

| Field | Rule |
|---|---|
| `bank_key` | Unique stable id, lowercase, dots and dashes: `swe.backend.k.idempotent-retry`. Never reuse or rename. |
| `type` | `mcq` (one answer), `multi_select` (several answers), `sjt` (scenario, options scored 0 to 3), `coding`, `code_review`. |
| `section` | `knowledge` (mcq, multi_select), `coding` (coding), `review` (code_review), `judgement` (sjt). |
| `format` | Knowledge only: `concept`, `code_output` ("what does this print") or `find_bug` ("which line is wrong"). |
| `tracks` | Array: `backend`, `frontend`, `fullstack`, `mobile`, `qa`, `devops`. Backend items are usually `["backend","fullstack"]`. |
| `levels` | Array of `L2` (Junior), `L3` (Mid), `L4` (Senior), `L5` (Lead). |
| `language` | `null` when language-neutral. `"javascript"` or `"python"` when the item shows code that only makes sense in that language (every `code_output` item). A candidate only sees items in the language they chose, or neutral ones. |
| `difficulty` | `easy`, `medium`, `hard` (prior guess, replaced by real statistics later). |
| `primary_skill_code` | One code from the list below. |
| `secondary_skill_codes` | Zero to two codes from the list below. |
| `prompt` | What the candidate reads. Markdown, code in fenced blocks. Plain English (candidates may be non-native speakers). |
| `explanation` | For reviewers only, never shown: why the key is right and every other option is wrong. |
| `group` | Optional lowercase slug. Items that are near-duplicates share a group, and a candidate never sees two items from the same group. |
| `expected_time_s` | Realistic seconds: knowledge 40 to 75, judgement 50 to 80, review 420 to 540, coding 1200 to 1500. |

## Per type

**mcq**:
- `choices`: 4 strings, all plausible, similar length.
- `answer`: `{ "correct": <index> }`.
- No "all of the above" or "none of the above", because options are shuffled per candidate.

**multi_select**:
- `choices`: 4 to 6 strings.
- `answer`: `{ "correct": [<indexes>] }`, with 2 to 3 correct.
- The prompt must say "Select all that apply."
- Scoring gives partial credit: (right picks minus wrong picks) divided by the number of correct options, floored at 0.

**sjt**:
- `choices`: 4 realistic actions. None of them is a cartoonishly bad option.
- `answer`: `{ "points": [p0, p1, p2, p3] }`, each 0 to 3.
- Exactly one option scores 3, and at least one scores 0 or 1.
- The prompt asks what the candidate would do (first / most likely).

**coding**:
```json
"coding": {
  "function_name": { "javascript": "groupByCustomer", "python": "group_by_customer" },
  "starter": { "javascript": "function groupByCustomer(orders) {\n  // your code\n}\n",
               "python": "def group_by_customer(orders):\n    # your code\n    pass\n" },
  "compare": "exact",
  "visible_tests": [ { "name": "two customers", "calls": [ { "args": [[...]], "expected": {...} } ] } ],
  "hidden_tests":  [ { "name": "empty list", "calls": [ { "args": [[]], "expected": {} } ] } ],
  "reference": { "javascript": "...full solution...", "python": "...full solution..." },
  "wrong": [ { "why": "forgets refunds", "javascript": "...", "python": "..." } ],
  "quality_focus": ["readability", "edge cases", "efficiency"]
}
```
- **Tests:** each test is a fresh program, and `calls` run in order on that same program, so stateful tasks such as a rate limiter work.
  - Args and expected values are JSON only (numbers, strings, booleans, null, arrays, objects with string keys).
  - Python receives the same JSON (dict, list, None).
- **`compare`:** `exact`, `unordered` (top-level array order ignored) or `float` (numbers within 1e-6).
- **Size:** 2 to 3 visible tests and 8 to 15 hidden tests. Hidden tests must include edge cases (empty input, boundaries, duplicates, large input that rules out quadratic solutions when that matters).
- **Solutions:** the reference must pass every test in both languages, and each `wrong` solution must fail at least one hidden test. The validator enforces both.
- **Prompt:** states the input, the output and every rule needed to pass the hidden tests. No hidden surprise rules.

**code_review**:
```json
"review": {
  "code": { "javascript": "...", "python": "..." },
  "issues": [ { "id": "sql_injection", "severity": "critical", "points": 3,
                "description": "query built by string concatenation from req.query.name" } ],
  "ideal_answer": "what a strong Mid engineer writes, most serious first"
}
```
- **The prompt asks:** "List the problems, most serious first, and how you would fix each."
- **Issues:** 3 to 5 real issues of mixed severity (`critical`, `major`, `minor`), plus no more than one red herring the candidate should not flag.

## Skill codes (use only these)

- **Existing:**
  - `engineering.programming.{javascript,typescript,python,python_async,sql}`
  - `engineering.system_design.{trade_offs,consistency,scaling,caching,queueing,data_modeling}`
  - `engineering.debugging.{hypothesis,tools,distributed}`
  - `engineering.operations.{monitoring,incident_response,reliability}`
  - `engineering.craft.{correctness,readability,testing,refactoring}`
  - `behavioral.communication.{clarity,written,listening}`
  - `behavioral.ownership.{accountability,initiative,failure_reflection}`
  - `behavioral.collaboration.{conflict,cross_functional}`
  - `behavioral.leadership.{mentorship,decision_making,setting_norms}`
  - `behavioral.problem_solving.{decomposition,first_principles,pragmatism}`
- **Added for written assessments (v1):**
  - `engineering.backend.{api_design,http}`
  - `engineering.data.{transactions,indexing}`
  - `engineering.security.{injection,auth,data_protection}`
  - `engineering.concurrency.fundamentals`
  - `engineering.performance.complexity`
  - `engineering.tooling.{git,containers}`
  - `engineering.algorithms.data_structures`
