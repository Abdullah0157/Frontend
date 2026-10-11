// Minimal client for Microsoft Edge's neural text-to-speech service.
//
// Why our own: in October 2026 the service started refusing (HTTP 403) the
// connection made by the msedge-tts npm package (2.0.5 and 2.0.9 alike), which
// silenced Iris and the English test's audio. The Python `edge-tts` package
// still worked; the difference is a `muid` cookie it sends. This client
// mirrors edge-tts's handshake (headers, Sec-MS-GEC token, cookie) so the
// fix is in our hands next time the service changes.

import { createHash, randomBytes, randomUUID } from 'node:crypto'
import WebSocket from 'ws'

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const CHROMIUM_FULL_VERSION = '143.0.3650.75'
const CHROMIUM_MAJOR = CHROMIUM_FULL_VERSION.split('.')[0]
const WSS_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`

// Sec-MS-GEC: SHA-256 of (Windows file-time ticks rounded down to 5 minutes + token).
function secMsGec() {
  const seconds = Math.floor(Date.now() / 1000) + 11644473600
  const rounded = seconds - (seconds % 300)
  return createHash('sha256').update(`${BigInt(rounded) * 10000000n}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase()
}

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;')

function dateString() {
  return new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)')
}

// 'en-IN-PrabhatNeural' -> 'Microsoft Server Speech Text to Speech Voice (en-IN, PrabhatNeural)'
function fullVoiceName(short) {
  const m = /^([a-z]{2}-[A-Z]{2})-(.+)$/.exec(short)
  return m ? `Microsoft Server Speech Text to Speech Voice (${m[1]}, ${m[2]})` : short
}

// Returns an MP3 Buffer (24 kHz, 48 kbit/s, mono). The service sometimes
// refuses a connection made right after another (HTTP 403); those attempts are
// retried with a short, growing pause.
export async function synthesize(voice, text, { timeoutMs = 30000, attempts = 7 } = {}) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      return await synthesizeOnce(voice, text, timeoutMs)
    } catch (e) {
      lastError = e
      if (!/HTTP 403|HTTP 429/.test(e.message)) throw e
      // Growing pause: about 1, 2, 4, 8... seconds (capped at 20s).
      await new Promise((r) => setTimeout(r, Math.min(20000, 1000 * 2 ** i) + Math.floor(Math.random() * 500)))
    }
  }
  throw lastError
}

function synthesizeOnce(voice, text, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = `${WSS_URL}&Sec-MS-GEC=${secMsGec()}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}&ConnectionId=${randomUUID().replace(/-/g, '')}`
    const ws = new WebSocket(url, {
      headers: {
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR}.0.0.0`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: `muid=${randomBytes(16).toString('hex').toUpperCase()};`,
      },
    })
    const chunks = []
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('text-to-speech timed out')) }, timeoutMs)
    const fail = (e) => { clearTimeout(timer); try { ws.terminate() } catch {} ; reject(e) }

    ws.on('open', () => {
      ws.send(
        `X-Timestamp:${dateString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n'
      )
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${escapeXml(fullVoiceName(voice))}'><prosody pitch='+0Hz' rate='+0%' volume='+0%'>${escapeXml(text)}</prosody></voice></speak>`
      ws.send(`X-RequestId:${randomUUID().replace(/-/g, '')}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${dateString()}Z\r\nPath:ssml\r\n\r\n${ssml}`)
    })
    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.from(data)
        const headerLen = buf.readUInt16BE(0)
        const header = buf.subarray(2, 2 + headerLen).toString()
        if (/Path:audio/.test(header)) chunks.push(buf.subarray(2 + headerLen))
        return
      }
      if (/Path:turn\.end/.test(String(data))) {
        clearTimeout(timer)
        ws.close()
        resolve(Buffer.concat(chunks))
      }
    })
    ws.on('unexpected-response', (_req, res) => fail(new Error(`text-to-speech refused (HTTP ${res.statusCode})`)))
    ws.on('error', fail)
  })
}
