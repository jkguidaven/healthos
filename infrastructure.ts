// ═══════════════════════════════════════════════════════════════
// src/lib/ai/claude-client.ts
// ─────────────────────────────────────────────────────────────
// The ONLY file in the codebase that makes requests to the
// Anthropic API. All features call callClaude() — never fetch() directly.
// ═══════════════════════════════════════════════════════════════

import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'
import {
  APIKeyMissingError,
  APIKeyInvalidError,
  AIParseError,
  AIApiError,
  AIRateLimitError,
} from './types'

const API_URL      = 'https://api.anthropic.com/v1/messages'
const MODEL        = 'claude-sonnet-4-6'
const API_VERSION  = '2023-06-01'
const SECURE_KEY   = 'anthropic_api_key'

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface CallClaudeParams<T> {
  system: string
  userMessage: string | ContentBlock[]
  schema: z.ZodType<T>
  maxTokens: number
}

export async function callClaude<T>(params: CallClaudeParams<T>): Promise<T> {
  // 1. Read API key from SecureStore
  const apiKey = await SecureStore.getItemAsync(SECURE_KEY)
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
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: params.maxTokens,
      system:     params.system,
      messages:   [{ role: 'user', content }],
    }),
  })

  // 4. Handle HTTP errors
  if (!response.ok) {
    if (response.status === 401) throw new APIKeyInvalidError()
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') ?? '60', 10)
      throw new AIRateLimitError(retryAfter)
    }
    throw new AIApiError(response.status)
  }

  // 5. Parse response
  const data = await response.json()
  const rawText: string = data?.content?.[0]?.text ?? ''

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


// ═══════════════════════════════════════════════════════════════
// src/lib/ai/api-key.ts
// ─────────────────────────────────────────────────────────────
// All SecureStore operations for the API key.
// This is the ONLY file that reads or writes the API key.
// ═══════════════════════════════════════════════════════════════

import * as SecureStore from 'expo-secure-store'
import { useUIStore } from '../stores/ui-store'

const SECURE_KEY = 'anthropic_api_key'
const TEST_URL   = 'https://api.anthropic.com/v1/messages'

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEY)
}

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, key)
  useUIStore.getState().setHasApiKey(true)
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY)
  useUIStore.getState().setHasApiKey(false)
}

export async function hydrateApiKeyStatus(): Promise<void> {
  const key = await SecureStore.getItemAsync(SECURE_KEY)
  useUIStore.getState().setHasApiKey(!!key)
}

export interface ValidationResult {
  valid: boolean
  error?: 'invalid_key' | 'network_error' | 'rate_limit'
}

export async function validateApiKey(key: string): Promise<ValidationResult> {
  try {
    const response = await fetch(TEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1,
        messages:   [{ role: 'user', content: 'hi' }],
      }),
    })

    if (response.status === 401)                       return { valid: false, error: 'invalid_key' }
    if (response.status === 429)                       return { valid: false, error: 'rate_limit' }
    if (response.ok || response.status === 400)        return { valid: true }   // 400 = bad request but key was accepted
    return { valid: false, error: 'network_error' }
  } catch {
    return { valid: false, error: 'network_error' }
  }
}


// ═══════════════════════════════════════════════════════════════
// src/test-utils/setup.ts
// ─────────────────────────────────────────────────────────────
// Jest setup file — runs before every test suite.
// Referenced in jest.config.ts as setupFilesAfterEnach.
// ═══════════════════════════════════════════════════════════════

import '@testing-library/jest-native/extend-expect'
import { server } from './msw-server'

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset handlers between tests (so one test's overrides don't leak)
afterEach(() => server.resetHandlers())

// Close server after all tests
afterAll(() => server.close())


// ═══════════════════════════════════════════════════════════════
// src/test-utils/msw-server.ts
// ─────────────────────────────────────────────────────────────
// MSW (Mock Service Worker) server for intercepting API calls in tests.
// Import and override handlers in individual test files for specific scenarios.
// ═══════════════════════════════════════════════════════════════

import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Default Anthropic API handler — returns a valid food scan response
const defaultClaudeHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => {
    return HttpResponse.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name:                'Test food',
            calories:            500,
            protein_g:           40,
            carbs_g:             50,
            fat_g:               15,
            serving_description: '1 serving',
            confidence:          'high',
          }),
        },
      ],
    })
  },
)

export const server = setupServer(defaultClaudeHandler)

// ─── Reusable handler overrides (import these in test files) ───

export const claudeWorkoutPlanHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    HttpResponse.json({
      content: [{
        type: 'text',
        text: JSON.stringify({
          plan_name:      'Test PPL plan',
          plan_rationale: 'A test plan for unit testing.',
          split_type:     'ppl',
          weeks_total:    8,
          days_per_week:  4,
          days: [{
            day_name:                  'Push A',
            muscle_groups:             ['chest', 'shoulders', 'triceps'],
            estimated_duration_minutes: 60,
            exercises: [{
              name:             'Barbell bench press',
              sets:             4,
              reps:             8,
              rest_seconds:     120,
              weight_kg:        null,
              progression_note: 'Add 2.5kg when all sets complete.',
            }],
          }],
        }),
      }],
    }),
)

export const claudeRateLimitHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => new HttpResponse(null, { status: 429, headers: { 'retry-after': '30' } }),
)

export const claudeInvalidKeyHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => new HttpResponse(null, { status: 401 }),
)

export const claudeMalformedResponseHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => HttpResponse.json({
    content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
  }),
)


// ═══════════════════════════════════════════════════════════════
// src/test-utils/render.tsx
// ─────────────────────────────────────────────────────────────
// renderWithProviders — use this instead of @testing-library/react-native's
// render() for any component that uses navigation, SQLite, or React Query.
// ═══════════════════════════════════════════════════════════════

import React, { type ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NavigationContainer } from '@react-navigation/native'

// Create a new QueryClient per test — no cache bleed between tests
function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries:   { retry: false },      // don't retry in tests
      mutations: { retry: false },
    },
  })
}

interface WrapperProps { children: React.ReactNode }

function AllProviders({ children }: WrapperProps) {
  const queryClient = makeTestQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        {children}
      </NavigationContainer>
    </QueryClientProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options })
}

export * from '@testing-library/react-native'


// ═══════════════════════════════════════════════════════════════
// src/lib/formulas/__tests__/body-fat.test.ts
// ─────────────────────────────────────────────────────────────
// Example unit test for a formula function.
// Every file in src/lib/formulas/ must have a co-located __tests__/ test.
// Pattern: describe the function → test known inputs → test boundary values.
// ═══════════════════════════════════════════════════════════════

import { calculateBodyFat, getBodyFatCategory } from '../body-fat'

describe('calculateBodyFat', () => {
  describe('male inputs', () => {
    it('returns expected result for standard male measurements', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 82, neckCm: 38 },
        78,
      )
      expect(result).not.toBeNull()
      expect(result!.bodyFatPct).toBeCloseTo(17.2, 0)
      expect(result!.category).toBe('fitness')
    })

    it('returns athletic category for lean male', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 180, waistCm: 75, neckCm: 40 },
        80,
      )
      expect(result!.category).toBe('athletic')
    })

    it('returns null when waist equals neck (physiologically invalid)', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 38, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausible height', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 50, waistCm: 82, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })
  })

  describe('female inputs', () => {
    it('returns expected result for standard female measurements', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: 95 },
        62,
      )
      expect(result).not.toBeNull()
      expect(result!.bodyFatPct).toBeGreaterThan(18)
      expect(result!.bodyFatPct).toBeLessThan(30)
    })

    it('returns null when hip measurement is missing for female', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32 },
        62,
      )
      expect(result).toBeNull()
    })
  })

  describe('lean mass and fat mass', () => {
    it('lean mass + fat mass equals total weight', () => {
      const totalWeightKg = 80
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 82, neckCm: 38 },
        totalWeightKg,
      )
      expect(result).not.toBeNull()
      const sum = result!.leanMassKg + result!.fatMassKg
      expect(sum).toBeCloseTo(totalWeightKg, 0)
    })
  })
})


// ═══════════════════════════════════════════════════════════════
// .github/workflows/ci.yml
// ─────────────────────────────────────────────────────────────
// GitHub Actions CI — runs on every push and PR to main.
// All checks must pass before a PR can be merged.
//
// NOTE: This is YAML — do not add TypeScript syntax here.
// Copy this content into .github/workflows/ci.yml in the repo root.
// ═══════════════════════════════════════════════════════════════

/*
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    name: Lint, type-check, and test
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test --coverage --passWithNoTests

      - name: Check no .env files committed
        run: |
          if find . -name ".env" -not -path "*/node_modules/*" | grep -q .; then
            echo "ERROR: .env file found in repository"
            exit 1
          fi
*/


// ═══════════════════════════════════════════════════════════════
// .github/pull_request_template.md
// ─────────────────────────────────────────────────────────────
// PR checklist shown to every contributor (human or AI agent).
// Copy this content into .github/pull_request_template.md
// ═══════════════════════════════════════════════════════════════

/*
## What changed

<!-- One sentence description of what this PR does -->

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes
- [ ] If schema changed: migration files are committed (`pnpm db:generate` was run)
- [ ] If prompt changed: tested against real Claude API manually
- [ ] No secrets, API keys, or `.env` files in the diff
- [ ] If `src/lib/ai/api-key.ts` changed: key is only written to SecureStore

## Files touched

<!-- List the main files changed and why -->

## Notes for reviewer

<!-- Anything the reviewer should know — edge cases, decisions made, follow-up work -->
*/
