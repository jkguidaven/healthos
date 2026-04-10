// ═══════════════════════════════════════════════════════════════
// src/lib/ai/ai-client.ts
// ─────────────────────────────────────────────────────────────
// The ONLY file in the codebase that makes requests to the AI provider.
// All features call callAI() — never fetch() directly.
//
// Provider: Google Gemini (free tier, no credit card required).
// Model: gemini-2.5-flash — vision-capable, structured output support,
// generous free quota (1500 requests/day, 15 RPM).
//
// To swap providers: rewrite the body of callAI() to call a different
// REST API. The function signature is provider-neutral.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod'
import { getApiKey } from './api-key'
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  AIParseError,
  AIApiError,
  AIRateLimitError,
} from './types'

const MODEL = 'gemini-2.5-flash'
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: string; data: string }
    }

export interface CallAIParams<T> {
  system: string
  userMessage: string | ContentBlock[]
  schema: z.ZodType<T>
  maxTokens: number
}

// Gemini "parts" — each user message is an array of these
type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

function toGeminiParts(message: string | ContentBlock[]): GeminiPart[] {
  if (typeof message === 'string') return [{ text: message }]
  return message.map((block): GeminiPart => {
    if (block.type === 'text') return { text: block.text }
    return {
      inlineData: {
        mimeType: block.source.media_type,
        data: block.source.data,
      },
    }
  })
}

export async function callAI<T>(params: CallAIParams<T>): Promise<T> {
  // 1. Read API key (api-key.ts handles SecureStore vs web fallback)
  const apiKey = await getApiKey()
  if (!apiKey) throw new APIKeyMissingError()

  // 2. Build Gemini request body
  const body = {
    contents: [
      {
        role: 'user',
        parts: toGeminiParts(params.userMessage),
      },
    ],
    systemInstruction: {
      parts: [{ text: params.system }],
    },
    generationConfig: {
      maxOutputTokens: params.maxTokens,
      // Gemini's structured-output mode — guarantees valid JSON
      responseMimeType: 'application/json',
    },
  }

  // 3. Make the request. Gemini takes the API key as a query param,
  // not a header — so it works in browser contexts without any extra
  // CORS opt-in header.
  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  // 4. Handle HTTP errors
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new APIKeyInvalidError()
    }
    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('retry-after') ?? '60',
        10,
      )
      throw new AIRateLimitError(retryAfter)
    }
    // Inspect 400 bodies for invalid-key cases (Gemini returns 400 for them)
    if (response.status === 400) {
      try {
        const text = await response.text()
        if (/api key/i.test(text) || /API_KEY_INVALID/i.test(text)) {
          throw new APIKeyInvalidError()
        }
      } catch (e) {
        if (e instanceof APIKeyInvalidError) throw e
      }
    }
    throw new AIApiError(response.status)
  }

  // 5. Parse response
  const data: unknown = await response.json()
  const rawText: string = extractText(data)

  // 6. Strip markdown fences defensively (Gemini sometimes wraps even in JSON mode)
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  // 7. Parse JSON
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new AIParseError(rawText)
  }

  // 8. Validate with Zod schema
  const result = params.schema.safeParse(parsed)
  if (!result.success) {
    throw new AIParseError(rawText)
  }

  return result.data
}

// Safely pull the first text part out of a Gemini response shape
// without resorting to `any`.
function extractText(data: unknown): string {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('candidates' in data) ||
    !Array.isArray((data as { candidates: unknown }).candidates)
  ) {
    return ''
  }
  const candidates = (data as { candidates: unknown[] }).candidates
  const first = candidates[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('content' in first) ||
    typeof (first as { content: unknown }).content !== 'object' ||
    (first as { content: unknown }).content === null
  ) {
    return ''
  }
  const content = (first as { content: { parts?: unknown } }).content
  if (!('parts' in content) || !Array.isArray(content.parts)) {
    return ''
  }
  const part = content.parts[0]
  if (
    typeof part === 'object' &&
    part !== null &&
    'text' in part &&
    typeof (part as { text: unknown }).text === 'string'
  ) {
    return (part as { text: string }).text
  }
  return ''
}
