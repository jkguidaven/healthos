/**
 * src/features/coach/use-coach.ts
 *
 * Layer 3 — feature hook for the AI coach tab.
 *
 * Boot sequence:
 *   1. Read the cached `coach_entry` for today via getTodayCoachEntry().
 *      If present, render it immediately and stop.
 *   2. If empty, build a fresh CoachContext from SQLite, call Gemini via
 *      callCoach(), and persist the result with saveCoachEntry().
 *
 * The expensive Gemini call is gated behind a missing-cache check so the
 * screen doesn't burn tokens on every focus. The user can force a refresh
 * with regenerate() — the screen wires this to the "Regenerate digest"
 * link when the cached entry is older than 7 days.
 *
 * Hard rules: no `any`, no raw SQL, no direct fetch — coach module owns
 * the AI call surface.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import {
  buildCoachContext,
  getTodayCoachEntry,
  saveCoachEntry,
} from '@db/queries/coach'
import { callCoach, type CoachResult } from '@/lib/ai/prompts/coach'
import { APIKeyInvalidError, APIKeyMissingError } from '@/lib/ai/types'
import { useApiKey } from '@/lib/ai/use-api-key'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface UseCoachReturn {
  /** Today's coach entry (cached or freshly generated). Null until loaded. */
  entry: CoachResult | null
  /** YYYY-MM-DD the loaded entry corresponds to. Null until loaded. */
  entryDate: string | null
  /** Initial cache read in flight. */
  loading: boolean
  /** A Gemini call is in flight. */
  generating: boolean
  /** Last error from a generation attempt, or null. */
  error: Error | null
  /** True when the user has no profile yet — render the locked empty state. */
  needsProfile: boolean
  /** Force a fresh Gemini call, overwriting today's cached row. */
  regenerate: () => Promise<void>
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useCoach(): UseCoachReturn {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])
  const profileId = useProfileStore((s) => s.profile?.id ?? null)
  const { markInvalid: markApiKeyInvalid } = useApiKey()

  const [entry, setEntry] = useState<CoachResult | null>(null)
  const [entryDate, setEntryDate] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [generating, setGenerating] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // Single error sink — also flips the global "API key invalid" flag
  // when the failure is auth-related so the inline banner shows up
  // instantly (and on every other AI surface in the app).
  const handleError = useCallback(
    (e: Error) => {
      if (e instanceof APIKeyInvalidError) {
        markApiKeyInvalid()
      }
      // APIKeyMissingError is already covered by the banner — the
      // store's hasApiKey flag drives that automatically.
      if (!(e instanceof APIKeyMissingError)) {
        setError(e)
      }
    },
    [markApiKeyInvalid],
  )

  // Initial load — cache first, generate only if missing.
  useEffect(() => {
    if (profileId === null) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const date = todayIso()
        const cached = await getTodayCoachEntry(db, date)
        if (cancelled) return

        if (cached) {
          setEntry(cached)
          setEntryDate(date)
          setLoading(false)
          return
        }

        // No cached entry — generate one.
        setLoading(false)
        await runGeneration(db, profileId, date, {
          onSuccess: (result) => {
            if (cancelled) return
            setEntry(result)
            setEntryDate(date)
          },
          onError: (e) => {
            if (cancelled) return
            handleError(e)
          },
          setGenerating: (v) => {
            if (cancelled) return
            setGenerating(v)
          },
        })
      } catch (e) {
        if (cancelled) return
        handleError(e instanceof Error ? e : new Error('Failed to load coach'))
        setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [db, profileId, handleError])

  // Public regenerate — wired to the "Regenerate digest" CTA.
  const regenerate = useCallback(async (): Promise<void> => {
    if (profileId === null || generating) return
    const date = todayIso()
    await runGeneration(db, profileId, date, {
      onSuccess: (result) => {
        setEntry(result)
        setEntryDate(date)
      },
      onError: handleError,
      setGenerating,
    })
  }, [db, profileId, generating, handleError])

  return {
    entry,
    entryDate,
    loading,
    generating,
    error,
    needsProfile: profileId === null,
    regenerate,
  }
}

// ─────────────────────────────────────────────
// Internal — single shared generation pipeline so the initial-load
// path and the manual "regenerate" button can't drift.
// ─────────────────────────────────────────────

interface RunGenerationCallbacks {
  onSuccess: (result: CoachResult) => void
  onError: (error: Error) => void
  setGenerating: (value: boolean) => void
}

async function runGeneration(
  db: ReturnType<typeof drizzle<typeof schema>>,
  profileId: number,
  date: string,
  cb: RunGenerationCallbacks,
): Promise<void> {
  cb.setGenerating(true)
  try {
    const context = await buildCoachContext(db, profileId)
    const result = await callCoach(context)
    await saveCoachEntry(db, profileId, date, result)
    cb.onSuccess(result)
  } catch (e) {
    cb.onError(
      e instanceof Error ? e : new Error('Could not generate coaching entry'),
    )
  } finally {
    cb.setGenerating(false)
  }
}
