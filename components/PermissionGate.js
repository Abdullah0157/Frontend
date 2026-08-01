'use client'

import { useEffect, useRef, useState } from 'react'
import { primeTTS } from '@/lib/tts'

/**
 * Blocks interview start until candidate grants:
 *  - Camera access (getUserMedia)
 *  - Screen share access (getDisplayMedia) — entire screen recommended
 *
 * Live previews only. Streams are passed to onReady; consumer is responsible
 * for stopping them.
 */
export default function PermissionGate({ candidateName, onReady, onCancel }) {
  const [cameraStream, setCameraStream] = useState(null)
  const [screenStream, setScreenStream] = useState(null)
  const [micStream, setMicStream] = useState(null)
  const [requesting, setRequesting] = useState({ camera: false, screen: false, mic: false })
  const [errors, setErrors] = useState({ camera: '', screen: '', mic: '' })

  const cameraVideoRef = useRef(null)
  const screenVideoRef = useRef(null)

  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream
    }
  }, [screenStream])

  // Detect if user stops sharing externally — clear the stream so they re-grant.
  useEffect(() => {
    if (!cameraStream) return
    const onEnd = () => setCameraStream(null)
    cameraStream.getTracks().forEach((t) => t.addEventListener('ended', onEnd))
    return () => cameraStream.getTracks().forEach((t) => t.removeEventListener('ended', onEnd))
  }, [cameraStream])
  useEffect(() => {
    if (!screenStream) return
    const onEnd = () => setScreenStream(null)
    screenStream.getTracks().forEach((t) => t.addEventListener('ended', onEnd))
    return () => screenStream.getTracks().forEach((t) => t.removeEventListener('ended', onEnd))
  }, [screenStream])
  useEffect(() => {
    if (!micStream) return
    const onEnd = () => setMicStream(null)
    micStream.getTracks().forEach((t) => t.addEventListener('ended', onEnd))
    return () => micStream.getTracks().forEach((t) => t.removeEventListener('ended', onEnd))
  }, [micStream])

  async function requestCamera() {
    setErrors((e) => ({ ...e, camera: '' }))
    setRequesting((r) => ({ ...r, camera: true }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      setCameraStream(stream)
    } catch (e) {
      setErrors((er) => ({ ...er, camera: humanizeMediaError(e, 'camera') }))
    } finally {
      setRequesting((r) => ({ ...r, camera: false }))
    }
  }

  async function requestScreen() {
    setErrors((e) => ({ ...e, screen: '' }))
    setRequesting((r) => ({ ...r, screen: true }))
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' }, // hints user to pick "entire screen"
        audio: false,
        // @ts-ignore — non-standard but supported in Chrome
        preferCurrentTab: false,
      })
      // Validate they actually shared a screen (vs window/tab)
      const track = stream.getVideoTracks()[0]
      const settings = track.getSettings()
      if (settings.displaySurface && settings.displaySurface !== 'monitor') {
        setErrors((er) => ({
          ...er,
          screen: `You shared a ${settings.displaySurface}. Please share your ENTIRE SCREEN instead.`,
        }))
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      setScreenStream(stream)
    } catch (e) {
      setErrors((er) => ({ ...er, screen: humanizeMediaError(e, 'screen') }))
    } finally {
      setRequesting((r) => ({ ...r, screen: false }))
    }
  }

  async function requestMic() {
    setErrors((e) => ({ ...e, mic: '' }))
    setRequesting((r) => ({ ...r, mic: true }))
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      setMicStream(stream)
    } catch (e) {
      setErrors((er) => ({ ...er, mic: humanizeMediaError(e, 'mic') }))
    } finally {
      setRequesting((r) => ({ ...r, mic: false }))
    }
  }

  function start() {
    if (!cameraStream || !screenStream || !micStream) return
    // Unlock audio inside this user gesture so audio.play() works without autoplay block
    primeTTS()
    try {
      const silent = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAAAAAA=='
      const a = new Audio(silent)
      const p = a.play()
      if (p) p.then(() => a.pause()).catch(() => {})
      else a.pause()
    } catch {}
    onReady({ cameraStream, screenStream, micStream })
  }

  function cancel() {
    if (cameraStream) cameraStream.getTracks().forEach((t) => t.stop())
    if (screenStream) screenStream.getTracks().forEach((t) => t.stop())
    if (micStream) micStream.getTracks().forEach((t) => t.stop())
    setCameraStream(null)
    setScreenStream(null)
    setMicStream(null)
    onCancel?.()
  }

  const cameraOk = !!cameraStream
  const screenOk = !!screenStream
  const micOk = !!micStream
  const ready = cameraOk && screenOk && micOk

  return (
    <div className="min-h-screen pt-32 pb-24 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            Proctored Interview
          </span>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">
            One last step{candidateName ? `, ${candidateName}` : ''}
          </h1>
          <p className="text-slate-500 mt-3 max-w-xl mx-auto">
            For this interview, we need your camera and screen share enabled. They stay live during the interview to ensure a fair process. Live monitoring only — nothing is recorded or stored.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Camera */}
          <div className={`rounded-[2rem] border p-6 transition-all ${cameraOk ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Step 1</p>
                <h3 className="font-black text-slate-900">Enable Camera</h3>
              </div>
              <span className={`text-xl ${cameraOk ? 'text-emerald-600' : 'text-slate-700'}`}>
                {cameraOk ? '✓' : '○'}
              </span>
            </div>

            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 mb-4 flex items-center justify-center relative">
              {cameraStream ? (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-slate-400 text-xs text-center px-4">
                  Camera preview will appear here
                </div>
              )}
            </div>

            {!cameraOk && (
              <button
                onClick={requestCamera}
                disabled={requesting.camera}
                className="w-full text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60"
              >
                {requesting.camera ? 'Requesting…' : 'Allow Camera'}
              </button>
            )}
            {errors.camera && (
              <p className="text-xs text-red-600 mt-3">{errors.camera}</p>
            )}
          </div>

          {/* Screen Share */}
          <div className={`rounded-[2rem] border p-6 transition-all ${screenOk ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Step 2</p>
                <h3 className="font-black text-slate-900">Share Entire Screen</h3>
              </div>
              <span className={`text-xl ${screenOk ? 'text-emerald-600' : 'text-slate-700'}`}>
                {screenOk ? '✓' : '○'}
              </span>
            </div>

            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 mb-4 flex items-center justify-center">
              {screenStream ? (
                <video
                  ref={screenVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-xs text-center px-4">
                  When prompted, select <strong className="text-slate-200">Entire Screen</strong>, not a window or tab
                </div>
              )}
            </div>

            {!screenOk && (
              <button
                onClick={requestScreen}
                disabled={requesting.screen}
                className="w-full text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60"
              >
                {requesting.screen ? 'Requesting…' : 'Share Entire Screen'}
              </button>
            )}
            {errors.screen && (
              <p className="text-xs text-red-600 mt-3">{errors.screen}</p>
            )}
          </div>

          {/* Microphone */}
          <div className={`rounded-[2rem] border p-6 transition-all ${micOk ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Step 3</p>
                <h3 className="font-black text-slate-900">Enable Microphone</h3>
              </div>
              <span className={`text-xl ${micOk ? 'text-emerald-600' : 'text-slate-700'}`}>
                {micOk ? '✓' : '○'}
              </span>
            </div>

            <div className="aspect-video rounded-2xl overflow-hidden bg-slate-900 mb-4 flex items-center justify-center">
              <div className="text-slate-400 text-xs text-center px-4">
                {micOk
                  ? <span className="text-emerald-400 font-bold">Microphone ready</span>
                  : 'Your voice will be captured during the interview'}
              </div>
            </div>

            {!micOk && (
              <button
                onClick={requestMic}
                disabled={requesting.mic}
                className="w-full text-xs font-black uppercase tracking-widest px-5 py-3 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-60"
              >
                {requesting.mic ? 'Requesting…' : 'Allow Microphone'}
              </button>
            )}
            {errors.mic && (
              <p className="text-xs text-red-600 mt-3">{errors.mic}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={start}
            disabled={!ready}
            className="btn-style-9 group uppercase tracking-widest text-xs !px-12 !py-5 rounded-full font-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="btn-shimmer"></div>
            <span>{ready ? 'Begin Interview' : 'Grant all permissions to begin'}</span>
          </button>
          <button
            onClick={cancel}
            className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  )
}

function humanizeMediaError(e, kind) {
  if (!e) return 'Unknown error'
  const msg = e.message || ''
  const name = e.name || ''
  if (name === 'NotAllowedError' || /denied|not allowed/i.test(msg)) {
    if (kind === 'screen') return 'You cancelled or denied screen sharing. Click again and pick "Entire Screen".'
    if (kind === 'mic') return 'Microphone access was denied. Allow microphone in your browser settings and click again.'
    return 'Camera access was denied. Allow camera in your browser site settings and click again.'
  }
  if (name === 'NotFoundError' || /not found/i.test(msg)) {
    if (kind === 'camera') return 'No camera was found. Plug one in and try again.'
    if (kind === 'mic') return 'No microphone was found. Plug one in and try again.'
    return 'No screen source available.'
  }
  if (name === 'NotReadableError') {
    return 'Device is in use by another app. Close other apps using the camera and try again.'
  }
  return `${name || 'Error'}: ${msg}`
}
