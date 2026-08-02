'use client'

import { useRef, useState, useCallback } from 'react'
import { LiveVoiceClient } from '@/lib/voice-live-client'

// Realtime voice interview UI (Gemini Live pilot). Talk to Maya with sub-2s,
// full-duplex audio — interrupt her and she stops. Requires the Python voice
// backend running (NEXT_PUBLIC_VOICE_WS_URL, or localhost:8000 in dev).
export default function LiveVoiceExperience({ role = 'Senior Backend Engineer' }) {
  const [status, setStatus] = useState('idle')   // idle|connecting|listening|speaking
  const [turns, setTurns] = useState([])           // [{role, text}]
  const [error, setError] = useState('')
  const clientRef = useRef(null)

  const onTranscript = useCallback(({ role: r, text }) => {
    if (!text) return
    setTurns((prev) => {
      const last = prev[prev.length - 1]
      // Coalesce streaming deltas from the same speaker into one bubble.
      if (last && last.role === r) {
        return [...prev.slice(0, -1), { role: r, text: (last.text + text).replace(/\s+/g, ' ') }]
      }
      return [...prev, { role: r, text }]
    })
  }, [])

  async function start() {
    setError('')
    setTurns([])
    const client = new LiveVoiceClient()
    clientRef.current = client
    try {
      await client.start({
        role,
        onStatus: setStatus,
        onTranscript,
        onError: (e) => setError(e.message || 'Voice error'),
      })
    } catch (e) {
      setError(e.message || 'Could not start voice. Allow microphone access and ensure the voice server is running.')
      setStatus('idle')
    }
  }

  function stop() {
    clientRef.current?.stop()
    clientRef.current = null
    setStatus('idle')
  }

  const live = status !== 'idle'
  const orb = {
    idle: 'bg-slate-200', connecting: 'bg-amber-400 animate-pulse',
    listening: 'bg-emerald-500 animate-pulse', speaking: 'bg-indigo-500 animate-pulse',
  }[status] || 'bg-slate-200'
  const statusLabel = {
    idle: 'Not connected', connecting: 'Connecting…',
    listening: 'Listening — go ahead', speaking: 'Maya is speaking…',
  }[status]

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-4">
          <span className={`w-14 h-14 rounded-full flex items-center justify-center ${live ? '' : 'border border-slate-200'}`}>
            <span className={`w-4 h-4 rounded-full ${orb}`} />
          </span>
          <div className="flex-1">
            <p className="text-lg font-bold text-slate-900">Live voice interview</p>
            <p className="text-sm text-slate-500">{statusLabel} · <span className="text-slate-400">{role}</span></p>
          </div>
          {!live ? (
            <button onClick={start}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
              Start
            </button>
          ) : (
            <button onClick={stop}
              className="px-6 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-sm font-semibold transition">
              End
            </button>
          )}
        </div>

        {error && (
          <div className="mt-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
            {error}
          </div>
        )}

        {live && (
          <p className="mt-5 text-xs text-slate-400">
            Speak naturally — you can interrupt Maya any time and she&apos;ll stop.
          </p>
        )}
      </div>

      {/* Live transcript */}
      {turns.length > 0 && (
        <div className="mt-6 space-y-3">
          {turns.map((t, i) => (
            <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                t.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
              }`}>
                <span className={`block text-[10px] font-bold uppercase tracking-widest mb-0.5 ${t.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {t.role === 'user' ? 'You' : 'Maya'}
                </span>
                {t.text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
