'use client'

import { useEffect, useRef, useState } from 'react'

const TEXT = {
  en: {
    title: 'Delete all your data?',
    body: (people: number) =>
      `This permanently deletes everything saved on this device: ${people} ${people === 1 ? 'person' : 'people'}, their answers, results and explanations.`,
    warning: 'This cannot be undone. You will start again from the welcome screen.',
    cancel: 'Cancel',
    confirm: 'Yes, delete everything',
    deleting: 'Deleting…',
    error: "Couldn't delete right now. Check your internet connection and try again.",
  },
  hi: {
    title: 'क्या आप अपना सारा डेटा मिटाना चाहते हैं?',
    body: (people: number) =>
      `इस डिवाइस पर सहेजी गई हर जानकारी हमेशा के लिए मिट जाएगी: ${people} ${people === 1 ? 'व्यक्ति' : 'लोग'}, उनके जवाब, नतीजे और व्याख्याएँ।`,
    warning: 'इसे वापस नहीं लाया जा सकता। आप फिर से शुरुआत की स्क्रीन से शुरू करेंगे।',
    cancel: 'रद्द करें',
    confirm: 'हाँ, सब मिटा दें',
    deleting: 'मिटाया जा रहा है…',
    error: 'अभी नहीं मिटा सके। इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।',
  },
}

/**
 * Confirmation for "Delete my data". Built on the native <dialog>, which gives
 * focus trapping, Esc to close and an inert background for free. Rendered only
 * while open, so every opening starts from a clean state.
 */
export function DeleteDataDialog({
  lang,
  people,
  onCancel,
  onConfirm,
}: {
  lang: 'hi' | 'en'
  people: number
  onCancel: () => void
  /** Should reject on failure, so the dialog can say so and stay open. */
  onConfirm: () => Promise<void>
}) {
  const t = TEXT[lang]
  const dialog = useRef<HTMLDialogElement>(null)
  const [status, setStatus] = useState<'idle' | 'deleting' | 'error'>('idle')

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  async function confirm() {
    setStatus('deleting')
    try {
      await onConfirm()
    } catch {
      setStatus('error')
    }
  }

  return (
    <dialog
      ref={dialog}
      lang={lang}
      aria-labelledby="delete-title"
      aria-describedby="delete-body"
      // Esc closes, except mid-delete, when closing would hide the outcome.
      onCancel={(e) => {
        if (status === 'deleting') e.preventDefault()
      }}
      onClose={onCancel}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/50"
    >
      <h2 id="delete-title" className="text-xl font-bold leading-snug">{t.title}</h2>
      <div id="delete-body" className="mt-3 flex flex-col gap-2 leading-relaxed">
        <p>{t.body(people)}</p>
        <p className="font-semibold text-danger">{t.warning}</p>
      </div>

      {status === 'error' && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger">
          {t.error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {/* First in the dialog, so it receives focus: Enter never deletes by accident. */}
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          disabled={status === 'deleting'}
          className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-background disabled:opacity-50"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={status === 'deleting'}
          className="rounded-lg bg-danger px-5 py-2.5 font-semibold text-background hover:opacity-90 disabled:opacity-60"
        >
          {status === 'deleting' ? t.deleting : t.confirm}
        </button>
      </div>
    </dialog>
  )
}
