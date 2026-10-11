// Measures how accurately speech-to-text (Whisper) transcribes each English
// accent (design section 7.4: "measure the bias"). Same sentences, spoken by
// neural voices in each accent, transcribed, compared word by word.
//   node scripts/measure-stt-accents.mjs        (SKIP_EDGE=1: Mac voices only)
// Note: these are synthetic voices, a first proxy. Before launch, repeat with
// real recordings from Pakistani, Indian, Filipino, Nigerian and UK speakers.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}
const { promptAudio, transcribe } = await import('../lib/speech.js')
const { wordMatch } = await import('../lib/english-scoring.js')

const TEXTS = [
  'Thank you for calling. I am sorry your parcel is late. I can arrange a new delivery for Thursday morning.',
  'Your refund of forty five dollars has been approved and should reach your account within five working days.',
  'Could you please confirm your date of birth and the first line of your address before we continue?',
  'I understand this is frustrating. Let me check your account and find the quickest way to fix it for you.',
]
const VOICES = {
  Indian: 'en-IN-PrabhatNeural', Nigerian: 'en-NG-EzinneNeural', Filipino: 'en-PH-RosaNeural', Kenyan: 'en-KE-ChilembaNeural',
  'South African': 'en-ZA-LeahNeural', Singaporean: 'en-SG-WayneNeural', British: 'en-GB-RyanNeural', Irish: 'en-IE-EmilyNeural',
  American: 'en-US-JennyNeural', Australian: 'en-AU-NatashaNeural', Canadian: 'en-CA-LiamNeural',
}
// Second set: the Mac's own voices (macOS `say`), local and free, so the check
// still runs when the online voice service is refusing connections.
const MAC_VOICES = {
  'Indian (Mac Rishi)': 'Rishi', 'Indian (Mac Tara)': 'Tara', 'South African (Mac)': 'Tessa',
  'Irish (Mac)': 'Moira', 'Australian (Mac)': 'Karen', 'British (Mac)': 'Daniel', 'American (Mac)': 'Samantha',
}
function macSpeech(voice, text) {
  const dir = mkdtempSync(join(tmpdir(), 'stt-say-'))
  try {
    execFileSync('say', ['-v', voice, '-o', join(dir, 'a.aiff'), text])
    execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16@16000', '-c', '1', join(dir, 'a.aiff'), join(dir, 'a.wav')])
    return readFileSync(join(dir, 'a.wav'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const rows = []
async function measure(accent, getAudio, mime) {
  const scores = []
  const misses = []
  let skipped = 0
  for (const text of TEXTS) {
    let audio
    try {
      audio = await getAudio(text)
    } catch (e) {
      skipped++ // the online voice service refused; not a speech-to-text result
      continue
    }
    const tr = await transcribe(audio, mime)
    const m = wordMatch(text, tr.text)
    scores.push(m)
    if (m < 1) misses.push(tr.text)
    await new Promise((r) => setTimeout(r, 3500)) // Groq free tier: 20 requests a minute
  }
  if (!scores.length) return rows.push({ accent, 'words right': 'skipped', 'perfect sentences': '-', example_miss: 'voice service refused' })
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  rows.push({ accent, 'words right': `${(mean * 100).toFixed(1)}%`, 'perfect sentences': `${scores.filter((x) => x === 1).length}/${scores.length}${skipped ? ` (${skipped} skipped)` : ''}`, example_miss: (misses[0] || '').slice(0, 70) })
}
for (const [accent, voice] of Object.entries(MAC_VOICES)) {
  await measure(accent, async (text) => macSpeech(voice, text), 'audio/wav')
}
if (process.env.SKIP_EDGE !== '1') {
  for (const [accent, voice] of Object.entries(VOICES)) {
    await measure(accent, async (text) => (await promptAudio([{ voice, text }])).bytes, 'audio/mpeg') // cached after the first run
  }
}
console.table(rows)
process.exit(0) // the database pool would otherwise keep the script alive
