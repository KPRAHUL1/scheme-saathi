import { NextResponse } from 'next/server'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { z } from 'zod'
import { getUser, unauthorized } from '@/lib/session'

/**
 * Read-aloud with Amazon Polly. Most laptops and many phones have no Hindi
 * voice installed, so the browser alone often can't read results aloud. Polly
 * gives every device the same natural Hindi and Indian-English voice.
 *
 * Polly's Indian voices cover Hindi and Indian English only; other languages
 * return 404 here and the browser falls back to the device's own voice.
 */

// Kajal is a neural voice that speaks both Hindi and Indian English.
const VOICES: Record<string, { LanguageCode: 'hi-IN' | 'en-IN' }> = {
  hi: { LanguageCode: 'hi-IN' },
  en: { LanguageCode: 'en-IN' },
}

const Body = z.object({
  // One result card or summary is a few hundred characters. The cap keeps a
  // single request from running up AWS usage.
  text: z.string().trim().min(1).max(1500),
  lang: z.string().min(2).max(10),
})

let polly: PollyClient | undefined

export async function POST(request: Request) {
  // Signed-in users only, so strangers can't spend the AWS account's usage.
  if (!(await getUser())) return unauthorized()

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }

  const voice = VOICES[body.data.lang.toLowerCase().split('-')[0]]
  if (!voice) return NextResponse.json({ error: 'No AWS voice for this language' }, { status: 404 })

  if (!process.env.AWS_ACCESS_KEY_ID) {
    return NextResponse.json({ error: 'AWS is not configured' }, { status: 503 })
  }

  try {
    polly ??= new PollyClient({ region: process.env.AWS_REGION || 'us-east-1', maxAttempts: 2 })
    const result = await polly.send(
      new SynthesizeSpeechCommand({
        Engine: 'neural',
        VoiceId: 'Kajal',
        LanguageCode: voice.LanguageCode,
        OutputFormat: 'mp3',
        Text: body.data.text,
      }),
    )
    if (!result.AudioStream) throw new Error('Polly returned no audio')
    const audio = await result.AudioStream.transformToByteArray()

    // Copied into a plain ArrayBuffer-backed array, which is what Response accepts.
    return new Response(new Uint8Array(audio), {
      headers: {
        'content-type': 'audio/mpeg',
        // The same text always sounds the same: let the browser reuse it.
        'cache-control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    // The browser falls back to the device voice, so log and move on.
    console.error('[speak]', error)
    return NextResponse.json({ error: 'Read-aloud is unavailable right now.' }, { status: 502 })
  }
}
