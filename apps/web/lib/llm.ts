import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

/**
 * The only file that knows which AI vendor we use. Routes ask for a JSON
 * object matching a zod schema; nothing else leaks out. Adding Bedrock later
 * means one more branch in getLLM(), with no route changes.
 */
export type Audio = { data: string; mimeType: string }

export interface LLM {
  json<T>(args: { system: string; prompt: string; schema: z.ZodType<T>; audio?: Audio }): Promise<T>
}

export class LLMError extends Error {}

function gemini(): LLM {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new LLMError('GEMINI_API_KEY is not set in .env')
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      // Free-tier Gemini returns 503 "high demand" and 429 rate limits in
      // bursts. Retry quickly, but bounded: 3 tries x 15s plus backoff stays
      // inside the routes' 60s maxDuration, so the UI can still fall back.
      timeout: 15_000,
      retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4, httpStatusCodes: [408, 429, 500, 502, 503, 504] },
    },
  })
  // Pinned rather than a "-latest" alias, so the demo can't change under us.
  // Not 2.5-flash: it is still listed, but new API keys get a 404 for it.
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

  return {
    async json({ system, prompt, schema, audio }) {
      const response = await ai.models.generateContent({
        model,
        // Audio rides in the same request as the instructions, not a separate transcription call.
        contents: audio ? [{ text: prompt }, { inlineData: audio }] : prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: z.toJSONSchema(schema),
          // Extraction and explanation reward consistency, not creativity.
          temperature: 0.2,
        },
      })
      const text = response.text
      if (!text) throw new LLMError('Model returned an empty response')

      // Constrained decoding makes this near-certain to pass, but the model's
      // output is still untrusted input until zod has checked it.
      const parsed = schema.safeParse(JSON.parse(text))
      if (!parsed.success) {
        throw new LLMError(`Model output failed validation: ${parsed.error.message}`)
      }
      return parsed.data
    },
  }
}

let cached: LLM | undefined

export function getLLM(): LLM {
  if (cached) return cached
  const provider = process.env.LLM_PROVIDER ?? 'gemini'
  switch (provider) {
    case 'gemini':
      return (cached = gemini())
    default:
      throw new LLMError(`LLM_PROVIDER "${provider}" is not implemented yet (available: gemini)`)
  }
}
