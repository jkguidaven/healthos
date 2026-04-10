// ═══════════════════════════════════════════════════════════════
// src/lib/ai/claude-client.ts
// ─────────────────────────────────────────────────────────────
// The ONLY file in the codebase that makes requests to the
// Anthropic API. All features call callClaude() — never fetch() directly.
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

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const API_VERSION = '2023-06-01'

export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image'
      source: { type: 'base64'; media_type: string; data: string }
    }

export interface CallClaudeParams<T> {
  system: string
  userMessage: string | ContentBlock[]
  schema: z.ZodType<T>
  maxTokens: number
}

export async function callClaude<T>(params: CallClaudeParams<T>): Promise<T> {
  // 1. Read API key (api-key.ts handles SecureStore vs web fallback)
  const apiKey = await getApiKey()
  if (!apiKey) throw new APIKeyMissingError()

  // 2. Build content array
  const content: ContentBlock[] =
    typeof params.userMessage === 'string'
      ? [{ type: 'text', text: params.userMessage }]
      : params.userMessage

  // 3. Make the request
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: [{ role: 'user', content }],
    }),
  })

  // 4. Handle HTTP errors
  if (!response.ok) {
    if (response.status === 401) throw new APIKeyInvalidError()
    if (response.status === 429) {
      const retryAfter = parseInt(
        response.headers.get('retry-after') ?? '60',
        10,
      )
      throw new AIRateLimitError(retryAfter)
    }
    throw new AIApiError(response.status)
  }

  // 5. Parse response
  const data: unknown = await response.json()
  const rawText: string = extractText(data)

  // 6. Strip markdown fences defensively
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

// Safely pull the first text block out of an Anthropic response shape
// without resorting to `any`.
function extractText(data: unknown): string {
  if (
    typeof data === 'object' &&
    data !== null &&
    'content' in data &&
    Array.isArray((data as { content: unknown }).content)
  ) {
    const content = (data as { content: unknown[] }).content
    const first = content[0]
    if (
      typeof first === 'object' &&
      first !== null &&
      'text' in first &&
      typeof (first as { text: unknown }).text === 'string'
    ) {
      return (first as { text: string }).text
    }
  }
  return ''
}
