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

/**
 * Gemini's "responseSchema" follows an OpenAPI-flavored JSON Schema dialect.
 * Pass one of these to constrain the model's output to a specific shape and
 * eliminate guessing on field names. Without it, JSON mode is "best effort"
 * and Gemini infers keys from the prompt — which often disagrees with our
 * Zod schema.
 *
 * Supported types per the Gemini docs:
 *   - OBJECT, ARRAY, STRING, NUMBER, INTEGER, BOOLEAN
 *
 * https://ai.google.dev/gemini-api/docs/structured-output
 */
export interface GeminiResponseSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN'
  description?: string
  enum?: string[]
  properties?: Record<string, GeminiResponseSchema>
  required?: string[]
  items?: GeminiResponseSchema
  nullable?: boolean
  format?: string
}

export interface CallAIParams<T> {
  system: string
  userMessage: string | ContentBlock[]
  schema: z.ZodType<T>
  maxTokens: number
  /** Gemini structured-output schema. Strongly recommended. */
  responseSchema?: GeminiResponseSchema
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

/** Sleep helper for retry backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Status codes worth retrying. Gemini returns 503 fairly often on the free
 * tier when their inference cluster is overloaded — usually a single retry
 * after a couple seconds is enough. 502 and 504 fall into the same bucket.
 */
const RETRYABLE_STATUSES = new Set<number>([502, 503, 504])
const MAX_RETRIES = 2

export async function callAI<T>(params: CallAIParams<T>): Promise<T> {
  // 1. Read API key (api-key.ts handles SecureStore vs web fallback)
  const apiKey = await getApiKey()
  if (!apiKey) throw new APIKeyMissingError()

  // 2. Build Gemini request body
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: params.maxTokens,
    // Gemini's structured-output mode — guarantees valid JSON
    responseMimeType: 'application/json',
    // Gemini 2.5 Flash has "thinking mode" enabled by default — the model
    // uses internal reasoning tokens BEFORE producing visible output, and
    // those count against maxOutputTokens. For structured JSON output we
    // don't need thinking; the schema does the heavy lifting. Disabling it
    // gives the entire token budget back to the actual response.
    thinkingConfig: {
      thinkingBudget: 0,
    },
  }
  if (params.responseSchema) {
    generationConfig.responseSchema = params.responseSchema
  }

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
    generationConfig,
  }

  // 3. Make the request. Gemini takes the API key as a query param,
  // not a header — so it works in browser contexts without any extra
  // CORS opt-in header. Retry on transient 5xx errors.
  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`

  let response: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!RETRYABLE_STATUSES.has(response.status)) break
    if (attempt === MAX_RETRIES) break
    // Backoff: 1.5s, 4s
    const delay = attempt === 0 ? 1500 : 4000
    console.warn(
      `[callAI] Gemini returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
    )
    await sleep(delay)
  }

  if (!response) throw new AIApiError(0)

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
  const finishReason: string | null = extractFinishReason(data)

  if (rawText.length === 0) {
    console.warn('[callAI] Gemini response had no text content. Full response:', JSON.stringify(data).slice(0, 1500))
    throw new AIParseError('')
  }

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
    if (finishReason === 'MAX_TOKENS') {
      console.warn(
        '[callAI] Gemini hit MAX_TOKENS and the response was truncated mid-JSON. Increase maxTokens for this prompt.',
      )
      throw new AIParseError(
        `Response truncated — Gemini hit maxTokens (${params.maxTokens}). Increase maxTokens for this prompt.`,
      )
    }
    console.warn('[callAI] Gemini returned non-JSON text:', cleaned.slice(0, 1000))
    throw new AIParseError(rawText)
  }

  // 8. Validate with Zod schema
  const result = params.schema.safeParse(parsed)
  if (!result.success) {
    console.warn(
      '[callAI] Gemini response failed schema validation. Issues:',
      result.error.issues,
      '\nReceived JSON:',
      JSON.stringify(parsed).slice(0, 1000),
    )
    throw new AIParseError(rawText)
  }

  return result.data
}

// ═══════════════════════════════════════════════════════════════
// CHAT MODE — multi-turn conversations with optional function calling.
// ─────────────────────────────────────────────────────────────
// Used by the coach chat feature. Unlike callAI(), this returns free
// text OR a function call (the caller runs the tool and loops).
//
// Gemini function-calling docs:
//   https://ai.google.dev/gemini-api/docs/function-calling
// ═══════════════════════════════════════════════════════════════

export interface GeminiToolSchema {
  type: 'OBJECT'
  properties?: Record<string, GeminiResponseSchema>
  required?: string[]
}

export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters?: GeminiToolSchema
}

export type ChatTurn =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'assistant'; functionCall: { name: string; args: Record<string, unknown> } }
  | { role: 'tool'; name: string; response: unknown }

export interface CallAIChatParams {
  system: string
  turns: ChatTurn[]
  tools?: GeminiFunctionDeclaration[]
  maxTokens: number
}

export type ChatResult =
  | { kind: 'text'; text: string }
  | { kind: 'functionCall'; name: string; args: Record<string, unknown> }

interface GeminiContent {
  role: 'user' | 'model'
  parts: (
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { content: unknown } } }
  )[]
}

function turnsToContents(turns: ChatTurn[]): GeminiContent[] {
  const out: GeminiContent[] = []
  for (const turn of turns) {
    if (turn.role === 'user') {
      out.push({ role: 'user', parts: [{ text: turn.text }] })
    } else if (turn.role === 'assistant') {
      if ('text' in turn) {
        out.push({ role: 'model', parts: [{ text: turn.text }] })
      } else {
        out.push({
          role: 'model',
          parts: [{ functionCall: turn.functionCall }],
        })
      }
    } else {
      // tool response — Gemini expects role 'user' with a functionResponse part
      out.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: turn.name,
              response: { content: turn.response },
            },
          },
        ],
      })
    }
  }
  return out
}

export async function callAIChat(params: CallAIChatParams): Promise<ChatResult> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new APIKeyMissingError()

  const body: Record<string, unknown> = {
    contents: turnsToContents(params.turns),
    systemInstruction: { parts: [{ text: params.system }] },
    generationConfig: {
      maxOutputTokens: params.maxTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (params.tools && params.tools.length > 0) {
    body.tools = [{ functionDeclarations: params.tools }]
  }

  const url = `${API_URL}?key=${encodeURIComponent(apiKey)}`

  let response: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!RETRYABLE_STATUSES.has(response.status)) break
    if (attempt === MAX_RETRIES) break
    const delay = attempt === 0 ? 1500 : 4000
    await sleep(delay)
  }

  if (!response) throw new AIApiError(0)

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new APIKeyInvalidError()
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10)
      throw new AIRateLimitError(retryAfter)
    }
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

  const data: unknown = await response.json()
  const fc = extractFunctionCall(data)
  if (fc) {
    return { kind: 'functionCall', name: fc.name, args: fc.args }
  }
  const text = extractText(data)
  if (text.length === 0) {
    console.warn('[callAIChat] Empty response. Raw:', JSON.stringify(data).slice(0, 1500))
    throw new AIParseError('')
  }
  return { kind: 'text', text }
}

function extractFunctionCall(
  data: unknown,
): { name: string; args: Record<string, unknown> } | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('candidates' in data) ||
    !Array.isArray((data as { candidates: unknown }).candidates)
  ) return null
  const first = (data as { candidates: unknown[] }).candidates[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('content' in first) ||
    typeof (first as { content: unknown }).content !== 'object' ||
    (first as { content: unknown }).content === null
  ) return null
  const content = (first as { content: { parts?: unknown } }).content
  if (!('parts' in content) || !Array.isArray(content.parts)) return null
  for (const part of content.parts) {
    if (
      typeof part === 'object' &&
      part !== null &&
      'functionCall' in part &&
      typeof (part as { functionCall: unknown }).functionCall === 'object' &&
      (part as { functionCall: unknown }).functionCall !== null
    ) {
      const fc = (part as { functionCall: { name?: unknown; args?: unknown } }).functionCall
      if (typeof fc.name === 'string') {
        const args =
          typeof fc.args === 'object' && fc.args !== null
            ? (fc.args as Record<string, unknown>)
            : {}
        return { name: fc.name, args }
      }
    }
  }
  return null
}

/**
 * Pull `candidates[0].finishReason` out of a Gemini response shape.
 * Returns null if absent. Useful for distinguishing legitimate parse
 * failures from "the model ran out of tokens mid-stream".
 *
 * Common values:
 *   - STOP — model finished naturally
 *   - MAX_TOKENS — hit the maxOutputTokens limit (response is truncated)
 *   - SAFETY — blocked by safety filter
 *   - RECITATION — blocked due to recitation
 *   - OTHER — unspecified
 */
function extractFinishReason(data: unknown): string | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('candidates' in data) ||
    !Array.isArray((data as { candidates: unknown }).candidates)
  ) {
    return null
  }
  const first = (data as { candidates: unknown[] }).candidates[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('finishReason' in first) ||
    typeof (first as { finishReason: unknown }).finishReason !== 'string'
  ) {
    return null
  }
  return (first as { finishReason: string }).finishReason
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
