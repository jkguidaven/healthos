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

import { useCallback, useMemo } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import type { NewFoodLogEntry } from '@db/schema'
import { insertFoodLogEntry } from '@db/queries/food-log'
import { useProfileStore } from '@/stores/profile-store'

import type { ManualFoodValues, Meal } from './manual-food-form'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface UseSaveManualFoodResult {
  save: (values: ManualFoodValues) => Promise<void>
}

// ─────────────────────────────────────────────
// Hook
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
