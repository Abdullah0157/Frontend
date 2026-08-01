// Convert Float32Array (16kHz mono PCM from Silero VAD) to WAV Blob for Whisper
export function float32ToWav(samples, sampleRate = 16000) {
  const len = samples.length
  const buf = new ArrayBuffer(44 + len * 2)
  const view = new DataView(buf)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); view.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE')
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true); ws(36, 'data'); view.setUint32(40, len * 2, true)
  let offset = 44
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}
