'use client'

/**
 * The browser's own print dialog, where "Save as PDF" is built in on desktop
 * and Android. Server-side PDF libraries can't shape Devanagari and most
 * Indian scripts, so letting the browser render the page keeps Hindi correct.
 */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90"
    >
      {label}
    </button>
  )
}
