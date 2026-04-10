/**
 * src/features/onboarding/use-onboarding.ts
 *
 * Layer 3 hook for onboarding step 1 (basic info / profile).
 *
 * Owns:
 *  - The Zod schema + form value type used by the screen.
 *  - The mutation that writes the profile row to SQLite and primes the
 *    Zustand profile store.
 *
 * Step 1 only collects biometric fields (age, sex, height, weight, units).
 * The schema's goal / activity / macro columns are populated with sensible
 * placeholder values here — step 2 will overwrite them once the user picks
 * a goal and activity level.
 */

import { useCallback } from 'react'
import { z } from 'zod'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from '@/lib/db/schema'
import { upsertProfile } from '@/lib/db/queries/profile'
import { useProfileStore } from '@/stores/profile-store'
import { calculateBMR, calculateTDEE } from '@/lib/formulas/tdee'

// ─────────────────────────────────────────────
// Schema + types
// ─────────────────────────────────────────────

export const profileFormSchema = z.object({
  age: z.coerce.number().int().min(13).max(100),
  sex: z.enum(['male', 'female']),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(300),
  units: z.enum(['metric', 'imperial']),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

// ─────────────────────────────────────────────
// Save mutation (step 1 persistence)
// ─────────────────────────────────────────────

type SaveProfileStep = (values: ProfileFormValues) => Promise<void>

export function useSaveProfileStep(): SaveProfileStep {
  const sqlite = useSQLiteContext()
  const db = drizzle(sqlite, { schema })
  const setProfile = useProfileStore((s) => s.setProfile)

  return useCallback<SaveProfileStep>(
    async (values) => {
      // Step 1 doesn't know the final goal / activity / macros yet, but the
      // schema requires non-null values for those columns. Seed them with
      // placeholder defaults — step 2 will overwrite the row.
      const bmr = calculateBMR({
        sex: values.sex,
        age: values.age,
        heightCm: values.heightCm,
        weightKg: values.weightKg,
      })
      const placeholderTdee = calculateTDEE(bmr, 'moderate')

      const saved = await upsertProfile(db, {
        age: values.age,
        sex: values.sex,
        heightCm: values.heightCm,
        weightKg: values.weightKg,
        units: values.units,
        goal: 'recomposition',
        activityLevel: 'moderate',
        experienceLevel: 'beginner',
        // Schema defaults cover equipment + daysPerWeek, but we still need
        // to supply the numeric goal columns (not-null, no default).
        goalCalories: placeholderTdee,
        goalProteinG: 0,
        goalCarbsG: 0,
        goalFatG: 0,
      })

      // The Zustand profile store uses a slightly different shape than the
      // DB row (activityLevel: number rather than enum). Map the DB row into
      // the store-friendly shape before priming the store.
      setProfile({
        id: saved.id,
        age: saved.age,
        sex: saved.sex,
        heightCm: saved.heightCm,
        weightKg: saved.weightKg,
        units: saved.units,
        goal: saved.goal,
        activityLevel: 0,
        goalCalories: saved.goalCalories,
        goalProteinG: saved.goalProteinG,
        goalCarbsG: saved.goalCarbsG,
        goalFatG: saved.goalFatG,
        experienceLevel: saved.experienceLevel,
      })
    },
    [db, setProfile],
  )
}
