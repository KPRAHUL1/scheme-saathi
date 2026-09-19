import { betaRefusalFallbackMiddleware } from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk'
import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

/**
 * The only file that knows which AI vendor we use. Routes ask for a JSON
 * object matching a zod schema; nothing else leaks out.
 *
 * LLM_PROVIDER picks the vendor for text. Voice always uses Gemini, because
 * Claude on Bedrock does not accept audio input.
 */
export type Audio = { data: string; mimeType: string }

/** How hard the model should think. Both of our tasks are simple, so low by default. */
export type Effort = 'low' | 'medium' | 'high'

export interface LLM {
  json<T>(args: {
    system: string
    prompt: string
    schema: z.ZodType<T>
    audio?: Audio
    effort?: Effort
  }): Promise<T>
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

/**
 * Claude on Amazon Bedrock. Authenticates with the AWS credentials in the
 * environment (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION) and is
 * billed to that AWS account: no Anthropic API key involved.
 */
function bedrock(): LLM {
  const client = new AnthropicBedrockMantle({
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    // Stay inside the routes' 60s maxDuration so the UI can still fall back.
    timeout: 50_000,
    maxRetries: 1,
    // Server-side refusal fallbacks aren't available on Bedrock, so the SDK's
    // client-side middleware re-runs a declined request on another model.
    middleware: [betaRefusalFallbackMiddleware([{ model: 'anthropic.claude-opus-4-8' }])],
  })
  const model = process.env.BEDROCK_MODEL || 'anthropic.claude-opus-5'

  return {
    async json({ system, prompt, schema, audio, effort = 'low' }) {
      if (audio) throw new LLMError('Claude on Bedrock does not accept audio; use the Gemini provider for voice')

      const response = await client.beta.messages.parse({
        model,
        max_tokens: 16_000,
        system,
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'adaptive' },
        output_config: { effort, format: betaZodOutputFormat(schema) },
      })

      // Check why it stopped before trusting the output.
      if (response.stop_reason === 'refusal') throw new LLMError('Model declined the request')
      if (response.stop_reason === 'max_tokens') throw new LLMError('Model output was cut off')
      if (!response.parsed_output) throw new LLMError('Model output did not match the schema')
      return response.parsed_output
    },
  }
}

const cached = new Map<string, LLM>()

function create(provider: string): LLM {
  const existing = cached.get(provider)
  if (existing) return existing
  let llm: LLM
  switch (provider) {
    case 'gemini':
      llm = gemini()
      break
    case 'bedrock':
      llm = bedrock()
      break
    default:
      throw new LLMError(`LLM_PROVIDER "${provider}" is not supported (use "bedrock" or "gemini")`)
  }
  cached.set(provider, llm)
  return llm
}

export function getLLM({ audio = false }: { audio?: boolean } = {}): LLM {
  // Claude on Bedrock takes text and images only, so recordings go to Gemini.
  return create(audio ? 'gemini' : process.env.LLM_PROVIDER ?? 'gemini')
}
