/**
 * src/lib/ai/use-api-key.ts
 *
 * Reactive hook that exposes the user's Gemini API-key status to UI
 * code. Backed by `useUIStore` (so screens automatically re-render
 * when the key is added, removed, or rejected).
 *
 * Three states:
 *   - 'ok'      → key present and not flagged invalid; AI calls allowed
 *   - 'missing' → no key in SecureStore; show the "Add API key" banner
 *   - 'invalid' → most recent AI call returned a 401/403/400 auth error;
 *                 show the "API key was rejected" banner
 *
 * Why a hook and not direct store access:
 *   - Subscribes to changes (the call sites in CLAUDE.md were reading
 *     `useUIStore.getState().hasApiKey` which is a one-shot snapshot,
 *     not reactive).
 *   - Hides the underlying store shape, so future moves (e.g. into a
 *     dedicated api-key store) don't ripple through the codebase.
 *   - Exposes a `markInvalid()` callback so call sites that catch
 *     `APIKeyInvalidError` can flip the banner without importing the
 *     store directly.
 */

import { useCallback } from 'react'
import { useUIStore } from '@/stores/ui-store'

export type ApiKeyStatus = 'ok' | 'missing' | 'invalid'

export interface UseApiKeyReturn {
  status: ApiKeyStatus
  /** Convenience flags so call sites don't have to compare strings. */
  hasKey: boolean
  isMissing: boolean
  isInvalid: boolean
  /** Flip the banner to "invalid" — call after catching an auth error. */
  markInvalid: () => void
  /** Manually clear the invalid flag (e.g. after a successful retry). */
  clearInvalid: () => void
}

export function useApiKey(): UseApiKeyReturn {
  const hasApiKey = useUIStore((s) => s.hasApiKey)
  const apiKeyInvalid = useUIStore((s) => s.apiKeyInvalid)
  const setApiKeyInvalid = useUIStore((s) => s.setApiKeyInvalid)

  const status: ApiKeyStatus = !hasApiKey
    ? 'missing'
    : apiKeyInvalid
      ? 'invalid'
      : 'ok'

  const markInvalid = useCallback((): void => {
    setApiKeyInvalid(true)
  }, [setApiKeyInvalid])

  const clearInvalid = useCallback((): void => {
    setApiKeyInvalid(false)
  }, [setApiKeyInvalid])

  return {
    status,
    hasKey: status === 'ok',
    isMissing: status === 'missing',
    isInvalid: status === 'invalid',
    markInvalid,
    clearInvalid,
  }
}
