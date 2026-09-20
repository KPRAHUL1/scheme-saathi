'use client'

import { Square, Volume2 } from 'lucide-react'
import type { Speaker } from '@/lib/speech'

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
      {active ? <Square size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
      {active ? 'Stop' : 'Listen'}
    </button>
  )
}
