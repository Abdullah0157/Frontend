// Realtime voice client for the Gemini Live backend relay (/v1/voice/ws).
//
// Captures the mic as 16 kHz mono PCM16 and streams it as binary WS frames;
// receives the model's 24 kHz PCM16 audio (binary) and plays it back gaplessly;
// receives transcripts + turn/barge-in events (JSON). Full duplex: the mic keeps
// streaming while the model speaks, so barge-in works — on an "interrupted"
// event we flush the playback queue immediately.
//
// The backend URL is configurable (NEXT_PUBLIC_VOICE_WS_URL); defaults to the
// local Python service. Vercel can't host the WS service — point this at the
// Render/Railway/Fly deployment once it's up.

const INPUT_RATE = 16000   // what the backend + Gemini Live expect
const OUTPUT_RATE = 24000  // what Gemini Live returns

function defaultWsUrl() {
  const env = process.env.NEXT_PUBLIC_VOICE_WS_URL
  if (env) return env
  if (typeof window !== 'undefined') {
    // Default to a local backend during dev.
    return 'ws://localhost:8000/v1/voice/ws'
  }
  return ''
}

// Float32 (inRate) → Int16 PCM (16 kHz), linear-interpolated resample.
function floatToPcm16k(float32, inRate) {
  if (inRate === INPUT_RATE) {
    const out = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) out[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7fff
    return out
  }
  const ratio = inRate / INPUT_RATE
  const outLen = Math.floor(float32.length / ratio)
  const out = new Int16Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const i0 = Math.floor(pos)
    const frac = pos - i0
    const s = (float32[i0] || 0) * (1 - frac) + (float32[i0 + 1] || 0) * frac
    out[i] = Math.max(-1, Math.min(1, s)) * 0x7fff
  }
  return out
}

function pcm16ToFloat32(int16) {
  const f = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) f[i] = int16[i] / 0x8000
  return f
}

export class LiveVoiceClient {
  constructor({ wsUrl } = {}) {
    this.wsUrl = wsUrl || defaultWsUrl()
    this.ws = null
    this.stream = null
    this.inCtx = null
    this.processor = null
    this.source = null
    this.outCtx = null
    this.nextStartTime = 0
    this.scheduled = []          // playback nodes, so barge-in can stop them
    this.running = false
    this.handlers = {}
  }

  _emit(type, payload) { this.handlers[type]?.(payload) }

  // opts: { role, seniority, name, voice, onStatus, onTranscript, onError }
  async start(opts = {}) {
    if (this.running) return
    this.handlers = opts
    this._emit('onStatus', 'connecting')

    // 1) Mic capture.
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    this.inCtx = new (window.AudioContext || window.webkitAudioContext)()
    this.outCtx = new (window.AudioContext || window.webkitAudioContext)()
    this.nextStartTime = 0
    this.source = this.inCtx.createMediaStreamSource(this.stream)
    this.processor = this.inCtx.createScriptProcessor(4096, 1, 1)
    this.source.connect(this.processor)
    this.processor.connect(this.inCtx.destination)

    // 2) WebSocket.
    this.ws = new WebSocket(this.wsUrl)
    this.ws.binaryType = 'arraybuffer'

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({
        role: opts.role || '', seniority: opts.seniority || '', name: opts.name || '', voice: opts.voice || '',
      }))
      this.running = true
      this._emit('onStatus', 'listening')
      // Stream mic PCM once the socket is open.
      this.processor.onaudioprocess = (e) => {
        if (!this.running || this.ws?.readyState !== WebSocket.OPEN) return
        const pcm = floatToPcm16k(e.inputBuffer.getChannelData(0), this.inCtx.sampleRate)
        this.ws.send(pcm.buffer)
      }
    }

    this.ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        let msg
        try { msg = JSON.parse(ev.data) } catch { return }
        if (msg.type === 'input_transcript' || msg.type === 'output_transcript') {
          this._emit('onTranscript', { role: msg.type === 'input_transcript' ? 'user' : 'assistant', text: msg.text || '' })
        } else if (msg.type === 'turn_complete') {
          this._emit('onStatus', 'listening')
        } else if (msg.type === 'interrupted') {
          this._flushPlayback()          // barge-in
          this._emit('onStatus', 'listening')
        } else if (msg.type === 'error') {
          this._emit('onError', new Error(msg.text || 'voice error'))
        }
        return
      }
      // Binary → model audio (PCM16 @ 24k).
      this._playPcm(new Int16Array(ev.data))
      this._emit('onStatus', 'speaking')
    }

    this.ws.onerror = () => this._emit('onError', new Error('voice connection error'))
    this.ws.onclose = () => { if (this.running) this.stop() }
  }

  _playPcm(int16) {
    if (!this.outCtx) return
    const f32 = pcm16ToFloat32(int16)
    const buf = this.outCtx.createBuffer(1, f32.length, OUTPUT_RATE)
    buf.getChannelData(0).set(f32)
    const node = this.outCtx.createBufferSource()
    node.buffer = buf
    node.connect(this.outCtx.destination)
    const t = Math.max(this.outCtx.currentTime, this.nextStartTime)
    node.start(t)
    this.nextStartTime = t + buf.duration
    this.scheduled.push(node)
    node.onended = () => { this.scheduled = this.scheduled.filter((n) => n !== node) }
  }

  _flushPlayback() {
    for (const n of this.scheduled) { try { n.stop() } catch {} }
    this.scheduled = []
    this.nextStartTime = this.outCtx ? this.outCtx.currentTime : 0
  }

  stop() {
    this.running = false
    this._flushPlayback()
    try { this.processor && (this.processor.onaudioprocess = null) } catch {}
    try { this.source?.disconnect() } catch {}
    try { this.processor?.disconnect() } catch {}
    try { this.stream?.getTracks().forEach((t) => t.stop()) } catch {}
    try { this.inCtx?.close() } catch {}
    try { this.outCtx?.close() } catch {}
    try { this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.close() } catch {}
    this.ws = null; this.stream = null; this.inCtx = null; this.outCtx = null; this.processor = null
    this._emit('onStatus', 'idle')
  }
}
