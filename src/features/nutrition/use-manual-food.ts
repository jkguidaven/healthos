/**
 * src/features/nutrition/use-manual-food.ts
 *
 * Layer 3 hook for manual food entry (issue #38).
 *
 * The manual-food form is the fallback path for when the camera / AI
 * scanner can't help — the user types macros directly and we save a
 * `source: 'manual'` row straight into the food_log table.
 *
 * This file owns:
 *   - The Drizzle handle + insert mutation for a manual entry.
 *   - The `meal` default selector based on the current time of day.
 *
 * The Zod schema + `ManualFoodValues` type live next to the form in
 * `manual-food-form.tsx` so the screen can import them directly (same
 * layering convention as the canonical feature example).
 *
 * No raw SQL, no `any`, no direct `fetch()`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import type { FoodLogEntry, NewFoodLogEntry } from '@db/schema'
import {
  deleteFoodLogEntry as deleteFoodLogEntryQuery,
  getFoodLogEntry,
  insertFoodLogEntry,
  updateFoodLogEntry,
} from '@db/queries/food-log'
import { useProfileStore } from '@/stores/profile-store'

import type { ManualFoodValues, Meal } from './manual-food-form'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface UseSaveManualFoodResult {
  save: (values: ManualFoodValues) => Promise<void>
}

// ─────────────────────────────────────────────
// Create hook
// ─────────────────────────────────────────────

export function useSaveManualFood(): UseSaveManualFoodResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])
  const profileId = useProfileStore((state) => state.profile?.id ?? null)

  const save = useCallback<UseSaveManualFoodResult['save']>(
    async (values) => {
      if (profileId === null) {
        throw new Error('No profile found — finish onboarding first.')
      }

      const entry: NewFoodLogEntry = {
        profileId,
        date: todayIso(),
        meal: values.meal,
        name: values.name.trim(),
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
        source: 'manual',
        confidence: null,
        aiNotes: null,
      }

      await insertFoodLogEntry(db, entry)
    },
    [db, profileId],
  )

  return { save }
}

// ─────────────────────────────────────────────
// Edit hook — loads an existing entry, exposes update + delete
// ─────────────────────────────────────────────

export interface UseEditFoodLogResult {
  /** The loaded entry, or null until the load completes / on failure. */
  entry: FoodLogEntry | null
  loading: boolean
  loadError: Error | null
  update: (values: ManualFoodValues) => Promise<void>
  remove: () => Promise<void>
}

export function useEditFoodLog(id: number | null): UseEditFoodLogResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const [entry, setEntry] = useState<FoodLogEntry | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    if (id === null) {
      setEntry(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getFoodLogEntry(db, id)
      .then((row) => {
        if (cancelled) return
        setEntry(row)
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e : new Error(String(e)))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [db, id])

  const update = useCallback<UseEditFoodLogResult['update']>(
    async (values) => {
      if (id === null || entry === null) {
        throw new Error('Cannot update — no entry loaded.')
      }
      // Preserve fields the user didn't edit (date, source, confidence,
      // aiNotes) — just overwrite the macros, name, and meal.
      await updateFoodLogEntry(db, id, {
        name: values.name.trim(),
        meal: values.meal,
        calories: values.calories,
        proteinG: values.proteinG,
        carbsG: values.carbsG,
        fatG: values.fatG,
      })
    },
    [db, id, entry],
  )

  const remove = useCallback<UseEditFoodLogResult['remove']>(
    async () => {
      if (id === null) {
        throw new Error('Cannot delete — no entry loaded.')
      }
      await deleteFoodLogEntryQuery(db, id)
    },
    [db, id],
  )

  return { entry, loading, loadError, update, remove }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Today as a `YYYY-MM-DD` string in the local timezone.
 * Matches the convention used elsewhere in the nutrition queries.
 */
function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Pick a sensible default meal based on the current hour.
 *  - breakfast: before 11:00
 *  - lunch:     11:00 – 14:59
 *  - dinner:    15:00 – 20:59
 *  - snack:     otherwise (late night / early morning)
 */
export function defaultMealForNow(now: Date = new Date()): Meal {
  const hour = now.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}
