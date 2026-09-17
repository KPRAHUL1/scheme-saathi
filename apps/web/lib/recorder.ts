'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Voice input by recording audio and letting Gemini listen to it.
 *
 * This replaced the browser's built-in speech recognition, which only works
 * in Chrome and Edge, needs the language chosen in advance, and took three
 * taps. Recording works in every modern browser, and Gemini detects the
 * language itself and reads the details in the same request as a typed
 * message, so voice costs no extra AI quota.
 */

const MAX_SECONDS = 60
// Plenty for speech, and keeps a full minute near 2 MB.
const SAMPLE_RATE = 16_000

export type RecorderState = 'idle' | 'recording' | 'preparing'

const noSubscribe = () => () => {}
const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const START_ERRORS: Record<string, string> = {
  NotAllowedError: 'Microphone access is blocked. Allow it from the icon in the address bar, then try again.',
  NotFoundError: 'No microphone was found on this device.',
  NotReadableError: 'The microphone is being used by another app. Close it and try again.',
  SecurityError: 'Voice input needs a secure (https) connection.',
}

type Active = { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; timer: ReturnType<typeof setInterval> }

/** `onRecorded` receives a base64 WAV, after Send or when the time limit is reached. */
export function useRecorder(onRecorded: (wavBase64: string) => void) {
  const supported = useSyncExternalStore(noSubscribe, canRecord, () => false)
  const [state, setState] = useState<RecorderState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<Active | null>(null)
  // The timer fires after renders have moved on; always call the latest callback.
  const latestOnRecorded = useRef(onRecorded)
  useEffect(() => {
    latestOnRecorded.current = onRecorded
  })

  useEffect(
    () => () => {
      const a = active.current
      if (!a) return
      clearInterval(a.timer)
      a.stream.getTracks().forEach((t) => t.stop())
    },
    [],
  )

  async function start() {
    if (active.current) return
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      setError(START_ERRORS[name] ?? "Couldn't start the microphone. Please type instead.")
      return
    }

    // Each browser picks its own format (WebM, Ogg, MP4); it is converted to WAV on Send.
    const recorder = new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    const startedAt = Date.now()
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS) void finish()
    }, 250)

    active.current = { recorder, stream, chunks, timer }
    setSeconds(0)
    setState('recording')
    recorder.start()
  }

  /** Stop and send. */
  async function finish() {
    const a = active.current
    if (!a) return
    active.current = null
    clearInterval(a.timer)
    setState('preparing')

    const stopped = new Promise<void>((resolve) => {
      a.recorder.onstop = () => resolve()
    })
    a.recorder.stop()
    await stopped
    a.stream.getTracks().forEach((t) => t.stop())

    try {
      const blob = new Blob(a.chunks, { type: a.recorder.mimeType })
      const wav = await toWavBase64(blob)
      setState('idle')
      setSeconds(0)
      latestOnRecorded.current(wav)
    } catch {
      setState('idle')
      setSeconds(0)
      setError("We couldn't use that recording. It may have been too short. Please try again, or type instead.")
    }
  }

  /** Stop and throw the recording away. */
  function cancel() {
    const a = active.current
    if (!a) return
    active.current = null
    clearInterval(a.timer)
    a.recorder.onstop = null
    if (a.recorder.state !== 'inactive') a.recorder.stop()
    a.stream.getTracks().forEach((t) => t.stop())
    setState('idle')
    setSeconds(0)
  }

  return { supported, state, seconds, maxSeconds: MAX_SECONDS, error, start, finish, cancel }
}

/**
 * Decodes whatever the browser recorded and re-encodes it as 16 kHz mono
 * 16-bit WAV: a format every AI audio API accepts, whichever browser made it.
 */
async function toWavBase64(blob: Blob): Promise<string> {
  const context = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer())
  } finally {
    void context.close()
  }

  // A one-channel offline context mixes stereo down and resamples in one pass.
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  // Convert in slices: spreading 2 MB into String.fromCharCode overflows the stack.
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
