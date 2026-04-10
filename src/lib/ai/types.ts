// ═══════════════════════════════════════════════════════════════
// src/lib/ai/types.ts
// ─────────────────────────────────────────────────────────────
// Typed error classes for every failure mode of the AI layer.
// Every feature that calls `callAI()` should narrow errors
// using the discriminated `code` property.
//
// Provider-neutral — these classes don't reference any specific vendor.
// ═══════════════════════════════════════════════════════════════

export class APIKeyMissingError extends Error {
  readonly code = 'key_missing' as const
  constructor() {
    super('No AI provider API key found in secure storage')
  }
}

export class APIKeyInvalidError extends Error {
  readonly code = 'key_invalid' as const
  constructor() {
    super('AI provider API key was rejected')
  }
}

export class AIParseError extends Error {
  readonly code = 'parse_error' as const
  constructor(public readonly raw: string) {
    super('AI provider returned a response that did not match the expected schema')
  }
}

export class AIApiError extends Error {
  readonly code = 'api_error' as const
  constructor(public readonly status: number) {
    super(`AI provider returned HTTP ${status}`)
  }
}

export class AIRateLimitError extends Error {
  readonly code = 'rate_limit' as const
  constructor(public readonly retryAfterSeconds: number) {
    super(`Rate limited. Retry after ${retryAfterSeconds}s`)
  }
}

export type AIError =
  | APIKeyMissingError
  | APIKeyInvalidError
  | AIParseError
  | AIApiError
  | AIRateLimitError
