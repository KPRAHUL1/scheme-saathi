'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

/**
 * Read-aloud. Hindi and English use Amazon Polly (app/api/speak), so every
 * device gets a natural voice even with no Hindi voice installed. Other
 * languages, or any AWS failure, fall back to the device's own voice.
 * (Voice input lives in recorder.ts.)
 */

// Languages Amazon Polly reads for us; keep in sync with app/api/speak.
const AWS_LANGUAGES = new Set(['hi', 'en'])

// Audio already fetched on this page, keyed by language and text, so
// replaying a card doesn't call AWS again.
const awsAudio = new Map<string, string>()

export const VOICE_LANGUAGES = [
  { code: 'hi-IN', label: 'हिंदी' },
  { code: 'en-IN', label: 'English' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
] as const

// Voices load asynchronously and change on `voiceschanged`. A module-level
// cache keeps the snapshot reference stable between changes, which
// useSyncExternalStore requires.
let voices: SpeechSynthesisVoice[] = []
const NO_VOICES: SpeechSynthesisVoice[] = []

function subscribeVoices(onChange: () => void) {
  if (!('speechSynthesis' in window)) return () => {}
  const update = () => {
    voices = window.speechSynthesis.getVoices()
    onChange()
  }
  update()
  window.speechSynthesis.addEventListener('voiceschanged', update)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
}

const baseLanguage = (lang: string) => lang.toLowerCase().split('-')[0]

/** Text to speech, one thing at a time across the whole page. */
export function useSpeaker() {
  const available = useSyncExternalStore(subscribeVoices, () => voices, () => NO_VOICES)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  // Flipped off after an AWS failure, so we stop asking for the rest of the visit.
  const [awsAvailable, setAwsAvailable] = useState(true)
  const playing = useRef<HTMLAudioElement | null>(null)
  // Bumped whenever playback stops, so a slow AWS response doesn't start
  // talking after the user has already moved on.
  const generation = useRef(0)

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel()
      playing.current?.pause()
    },
    [],
  )

  // Prefer the Indian variant ("hi-IN", "en-IN"), then any voice for the language.
  function voiceFor(lang: string) {
    const base = baseLanguage(lang)
    const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
    return available.find((v) => norm(v) === `${base}-in`) ?? available.find((v) => norm(v).startsWith(base))
  }

  const finished = (id: string) => setSpeakingId((current) => (current === id ? null : current))

  function stopCurrent() {
    generation.current++
    window.speechSynthesis?.cancel()
    playing.current?.pause()
    playing.current = null
  }

  function speakWithDevice(id: string, text: string, lang: string) {
    const voice = voiceFor(lang)
    if (!voice) {
      finished(id)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = 0.95
    utterance.onend = () => finished(id)
    utterance.onerror = () => finished(id)
    window.speechSynthesis.speak(utterance)
  }

  /** Resolves false if AWS couldn't produce audio, so the caller can fall back. */
  async function speakWithAws(id: string, text: string, lang: string, mine: number): Promise<boolean> {
    const key = `${lang}:${text}`
    let url = awsAudio.get(key)
    if (!url) {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, lang }),
      })
      if (!res.ok) return false
      url = URL.createObjectURL(await res.blob())
      awsAudio.set(key, url)
    }
    if (mine !== generation.current) return true

    const audio = new Audio(url)
    audio.onended = () => finished(id)
    audio.onerror = () => finished(id)
    playing.current = audio
    await audio.play()
    return true
  }

  function toggle(id: string, text: string, lang: string) {
    const wasSpeaking = speakingId === id
    stopCurrent()
    if (wasSpeaking) {
      setSpeakingId(null)
      return
    }
    setSpeakingId(id)

    const base = baseLanguage(lang)
    if (!awsAvailable || !AWS_LANGUAGES.has(base)) {
      speakWithDevice(id, text, lang)
      return
    }
    const mine = generation.current
    void speakWithAws(id, text, base, mine)
      .catch(() => false)
      .then((ok) => {
        if (ok || mine !== generation.current) return
        setAwsAvailable(false)
        speakWithDevice(id, text, lang)
      })
  }

  function stopAll() {
    stopCurrent()
    setSpeakingId(null)
  }

  const canSpeak = (lang: string) => (awsAvailable && AWS_LANGUAGES.has(baseLanguage(lang))) || !!voiceFor(lang)

  return { canSpeak, speakingId, toggle, stopAll }
}

export type Speaker = ReturnType<typeof useSpeaker>
