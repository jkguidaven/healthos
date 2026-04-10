/**
 * src/features/settings/use-api-key.ts
 *
 * Feature hooks for the settings API key flow.
 *
 * - useMaskedApiKey():   reads the stored Gemini key once on mount, returns a
 *                        display-safe masked string ("AIza••••••••••••"). The
 *                        raw key never leaves this hook.
 * - useUpdateApiKey():   state machine that validates a new key and saves it
 *                        via the existing api-key module. Never logs the key.
 *
 * Both hooks delegate ALL SecureStore work to `src/lib/ai/api-key.ts` — this
 * file just orchestrates UI state and masking.
 */

import { useEffect, useState, useCallback } from 'react'
import { useUIStore } from '@/stores/ui-store'
import {
  clearApiKey,
  getApiKey,
  saveApiKey,
  validateApiKey,
  type ValidationErrorCode,
} from '@ai/api-key'

const MASK_CHAR = '\u2022' // bullet
const MASK_LENGTH = 12

/**
 * Produce a safe-to-display version of a Gemini key.
 * Shows the first 4 characters (the "AIza" prefix) and 12 dots, so the user
 * can recognise that *a* key is set without ever seeing the full value.
 */
function maskKey(raw: string): string {
  const prefix = raw.slice(0, 4)
  return `${prefix}${MASK_CHAR.repeat(MASK_LENGTH)}`
}

interface MaskedApiKeyState {
  masked: string
  loading: boolean
  refresh: () => Promise<void>
}

export function useMaskedApiKey(): MaskedApiKeyState {
  const hasApiKey = useUIStore((s) => s.hasApiKey)
  const [masked, setMasked] = useState<string>('Not set')
  const [loading, setLoading] = useState<boolean>(true)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    const key = await getApiKey()
    if (key && key.length > 0) {
      setMasked(maskKey(key))
    } else {
      setMasked('Not set')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    // Re-read whenever the global hasApiKey flag flips (e.g. after an update
    // in the modal screen).
  }, [load, hasApiKey])

  return { masked, loading, refresh: load }
}

// ─────────────────────────────────────────────
// useUpdateApiKey — validate + save state machine
// ─────────────────────────────────────────────

export type UpdateStatus = 'idle' | 'validating' | 'success' | 'error'

interface UpdateApiKeyState {
  status: UpdateStatus
  errorCode: ValidationErrorCode | null
  update: (key: string) => Promise<void>
  reset: () => void
  remove: () => Promise<void>
}

export function useUpdateApiKey(): UpdateApiKeyState {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [errorCode, setErrorCode] = useState<ValidationErrorCode | null>(null)

  const update = useCallback(async (key: string): Promise<void> => {
    const trimmed = key.trim()
    if (trimmed.length === 0) return
    if (status === 'validating' || status === 'success') return

    setStatus('validating')
    setErrorCode(null)

    const result = await validateApiKey(trimmed)

    if (result.valid) {
      await saveApiKey(trimmed)
      setStatus('success')
      return
    }

    setErrorCode(result.error ?? 'network_error')
    setStatus('error')
  }, [status])

  const reset = useCallback((): void => {
    setStatus('idle')
    setErrorCode(null)
  }, [])

  const remove = useCallback(async (): Promise<void> => {
    await clearApiKey()
    setStatus('idle')
    setErrorCode(null)
  }, [])

  return { status, errorCode, update, reset, remove }
}
