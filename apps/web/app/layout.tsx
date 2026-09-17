import type { Metadata } from 'next'
import { Noto_Sans, Noto_Sans_Devanagari } from 'next/font/google'
import './globals.css'

const notoSans = Noto_Sans({ variable: '--font-noto-sans', subsets: ['latin'] })

// Geist has no Devanagari glyphs, so Hindi and Marathi would fall back to
// whatever the device has. Other scripts use the system's Noto fonts.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: '--font-noto-devanagari',
  subsets: ['devanagari'],
})

export const metadata: Metadata = {
  title: 'Scheme Saathi: find government schemes you can get',
  description:
    'Describe yourself in any Indian language and see which government schemes you may qualify for, explained simply.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${notoSans.variable} ${notoDevanagari.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  )
}
