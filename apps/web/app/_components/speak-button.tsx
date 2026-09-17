'use client'

import type { Speaker } from '@/lib/speech'
import { SpeakerIcon, StopIcon } from './icons'

/** Hidden when the device has no voice for the language, rather than failing on tap. */
export function SpeakButton({
  id,
  text,
  lang,
  speaker,
}: {
  id: string
  text: string
  lang: string
  speaker: Speaker
}) {
  if (!speaker.canSpeak(lang)) return null
  const active = speaker.speakingId === id

  return (
    <button
      type="button"
      onClick={() => speaker.toggle(id, text, lang)}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
        active ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:border-accent'
      }`}
    >
      {active ? <StopIcon /> : <SpeakerIcon />}
      {active ? 'Stop' : 'Listen'}
    </button>
  )
}
