# API key flow

> Agent reference: this document describes the full lifecycle of the Gemini API key in HealthOS.
> Read this before modifying anything in `src/lib/ai/api-key.ts`, `src/features/onboarding/api-key-step.tsx`, or `src/features/settings/api-key-settings.tsx`.

---

## Overview

HealthOS requires a Google Gemini API key to use AI features (food scanning, workout plan generation, coaching). The key is entered by the user inside the app at first launch and stored securely on-device. There is no `.env` file, no server, and no shared key — every user brings their own free key from Google AI Studio.

```
User opens app for first time
  → onboarding: profile form (Step 1)
  → onboarding: api key input (Step 2)
      → validate key against Google's models list endpoint
      → on success: save to SecureStore, set hasApiKey = true
      → navigate to dashboard
```

---

## Storage

| Where | What | Why |
|---|---|---|
| `expo-secure-store` key `'gemini_api_key'` | The raw key string | Encrypted via iOS Keychain / Android Keystore |
| Zustand `ui-store.hasApiKey` | Boolean only | Fast gate check without hitting SecureStore on every render |
| Nowhere else | — | Key is never in SQLite, AsyncStorage, logs, or state |

---

## Files involved

| File | Responsibility |
|---|---|
| `src/lib/ai/api-key.ts` | All SecureStore read/write/validate operations — the single source of truth |
| `src/lib/ai/ai-client.ts` | Calls `getApiKey()` before every API request |
| `src/features/onboarding/api-key-step.tsx` | First-launch key collection UI |
| `src/features/settings/api-key-settings.tsx` | Post-onboarding key management UI |
| `src/stores/ui-store.ts` | `hasApiKey: boolean` — hydrated at boot, updated on save/clear |
| `app/_layout.tsx` | Boots the app, reads SecureStore once to hydrate `hasApiKey` |

---

## `src/lib/ai/api-key.ts` — full API

```typescript
const SECURE_STORE_KEY = 'gemini_api_key' as const

/**
 * Returns the stored API key, or null if not set.
 * This is the only function ai-client.ts should call.
 */
export async function getApiKey(): Promise<string | null>

/**
 * Saves a validated key to SecureStore and updates ui-store.hasApiKey.
 * Only call this AFTER validateApiKey() returns { valid: true }.
 */
export async function saveApiKey(key: string): Promise<void>

/**
 * Clears the key from SecureStore and sets ui-store.hasApiKey = false.
 */
export async function clearApiKey(): Promise<void>

/**
 * Makes a lightweight GET request to Google's models list endpoint
 * (https://generativelanguage.googleapis.com/v1beta/models?key=<key>)
 * to confirm the key is accepted by the Gemini API.
 *
 * Does NOT save the key — caller is responsible for calling saveApiKey() on success.
 */
export async function validateApiKey(key: string): Promise<{
  valid: boolean
  error?: 'invalid_key' | 'network_error' | 'rate_limit'
}>

/**
 * Called once at app boot from app/_layout.tsx.
 * Reads SecureStore and syncs hasApiKey into ui-store.
 * Does not expose the key itself.
 */
export async function hydrateApiKeyStatus(): Promise<void>
```

---

## Error types

Defined in `src/lib/ai/types.ts`:

```typescript
export class APIKeyMissingError extends Error {
  code = 'key_missing' as const
}

export class APIKeyInvalidError extends Error {
  code = 'key_invalid' as const
}
```

`ai-client.ts` throws `APIKeyMissingError` when `getApiKey()` returns null. It throws `APIKeyInvalidError` when the Gemini API responds with an authentication failure (HTTP 400/401/403 with an `API_KEY_INVALID` reason).

React Query catches both in `onError` callbacks in feature hooks. The UI layer distinguishes between them:

| Error | UI behaviour |
|---|---|
| `APIKeyMissingError` | Banner: "AI features need an API key" + "Configure" button → Settings |
| `APIKeyInvalidError` | Banner: "API key was rejected" + "Update key" button → Settings |
| `rate_limit` | Banner: "Rate limit hit, retrying in Xs" (React Query handles retry) |
| `api_error` | Banner: "Something went wrong" + retry button |
| `parse_error` | Banner: "Unexpected response from the AI" + retry button |

---

## Onboarding step 2 — `api-key-step.tsx`

```
UI state machine:
  idle       → user sees input + "Validate & Save" button
  validating → spinner, input disabled
  error      → inline error message below input, input re-enabled
  success    → brief success state, then navigates to dashboard
```

Input: `TextInput` with `secureTextEntry={true}` and placeholder `AIza…`. The key is never shown in plain text after the user types it — the input clears on blur.

The step renders a two-line explanation:
> "HealthOS uses Google's Gemini API for AI features. Your key is stored securely on this device and never sent anywhere except Google's servers."

And a tappable link: "Get a free API key at aistudio.google.com/apikey →" with a small "Free tier — no credit card required" note.

---

## Settings screen — `api-key-settings.tsx`

Shows:
- Masked key display: `AIza••••••••••••••••` (first 4 chars + mask)
- "Update key" button → opens a modal with the same input + validation flow
- "Remove key" button → confirmation alert → `clearApiKey()` → back to onboarding step 2

---

## Boot sequence

```
app/_layout.tsx mounts
  → await hydrateApiKeyStatus()           // reads SecureStore, sets hasApiKey in ui-store
  → await migrateDbIfNeeded(db)           // Drizzle migrations
  → check profile table row count
  → if no profile OR !hasApiKey → push to /onboarding
  → else → push to /(tabs)
```

---

## Testing

`api-key.ts` pure functions are tested in `src/lib/ai/__tests__/api-key.test.ts`.

SecureStore is mocked via jest:
```typescript
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}))
```

`validateApiKey` is tested with MSW intercepting the Gemini models endpoint (`https://generativelanguage.googleapis.com/v1beta/models`) — never calls the real API in tests.

---

## ADR reference

See `docs/decisions/004-in-app-api-key.md` for the full decision record explaining why in-app SecureStore was chosen over `.env`, EAS Secrets, or a shared proxy key.

---

*Last updated: April 2026.*
