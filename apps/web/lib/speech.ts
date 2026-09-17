'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Read-aloud using the browser's built-in speech synthesis: free, no key,
 * and it works wherever the device has a voice installed for the language.
 * (Voice input lives in recorder.ts.)
 */

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

/** Text to speech, one thing at a time across the whole page. */
export function useSpeaker() {
  const available = useSyncExternalStore(subscribeVoices, () => voices, () => NO_VOICES)
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  // Prefer the Indian variant ("hi-IN", "en-IN"), then any voice for the language.
  function voiceFor(lang: string) {
    const base = lang.toLowerCase().split('-')[0]
    const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
    return available.find((v) => norm(v) === `${base}-in`) ?? available.find((v) => norm(v).startsWith(base))
  }

  function toggle(id: string, text: string, lang: string) {
    const synth = window.speechSynthesis
    synth.cancel()
    if (speakingId === id) {
      setSpeakingId(null)
      return
    }
    const voice = voiceFor(lang)
    const utterance = new SpeechSynthesisUtterance(text)
    if (voice) utterance.voice = voice
    utterance.lang = voice?.lang ?? lang
    utterance.rate = 0.95
    const done = () => setSpeakingId((current) => (current === id ? null : current))
    utterance.onend = done
    utterance.onerror = done
    setSpeakingId(id)
    synth.speak(utterance)
  }

  function stopAll() {
    window.speechSynthesis?.cancel()
    setSpeakingId(null)
  }

  return { canSpeak: (lang: string) => !!voiceFor(lang), speakingId, toggle, stopAll }
}

export type Speaker = ReturnType<typeof useSpeaker>
