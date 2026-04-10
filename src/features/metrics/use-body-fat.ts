/**
 * src/features/metrics/use-body-fat.ts
 *
 * Layer 3 — Feature hook for the body fat calculator.
 *
 * Owns the form state (waist / neck / hip as strings while the user is
 * typing), derives a live `BodyFatResult` via the pure Navy formula, and
 * exposes a react-query mutation that upserts today's body_metric row.
 *
 * The screen component is dumb — it only calls into this hook. The DB
 * handle is created with the typed Drizzle schema so queries are fully
 * inferred. No raw SQL, no direct fetch, no `any`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from '@db/schema'
import { upsertBodyMetric } from '@db/queries/metrics'
import {
  calculateBodyFat,
  type BodyFatResult,
} from '@formulas/body-fat'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

export interface BodyFatFormValues {
  waistCm: string
  neckCm: string
  hipCm: string // only consumed when profile.sex === 'female'
}

export interface UseBodyFatReturn {
  values: BodyFatFormValues
  setField: (field: keyof BodyFatFormValues, value: string) => void

  liveResult: BodyFatResult | null

  save: () => void
  isSaving: boolean
  saveError: Error | null
  saveSuccess: boolean
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useBodyFat(): UseBodyFatReturn {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((s) => s.profile)

  const [values, setValues] = useState<BodyFatFormValues>({
    waistCm: '',
    neckCm: '',
    hipCm: '',
  })

  const setField = useCallback(
    (field: keyof BodyFatFormValues, value: string): void => {
      setValues((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  // Live calculation — recompute whenever the form or profile changes.
  const liveResult = useMemo<BodyFatResult | null>(() => {
    if (!profile) return null

    const waist = parseFloat(values.waistCm)
    const neck = parseFloat(values.neckCm)
    const hip = parseFloat(values.hipCm)

    if (Number.isNaN(waist) || Number.isNaN(neck)) return null
    if (profile.sex === 'female' && Number.isNaN(hip)) return null

    return calculateBodyFat(
      {
        sex: profile.sex,
        heightCm: profile.heightCm,
        waistCm: waist,
        neckCm: neck,
        hipCm: profile.sex === 'female' ? hip : undefined,
      },
      profile.weightKg,
    )
  }, [profile, values])

  // Save mutation — upserts today's row via the Drizzle query helper.
  const mutation = useMutation<void, Error, void>({
    mutationFn: async (): Promise<void> => {
      if (!profile) throw new Error('Profile missing — finish onboarding first')
      if (!liveResult) throw new Error('Enter valid measurements first')

      const today = new Date().toISOString().split('T')[0]
      const waist = parseFloat(values.waistCm)
      const neck = parseFloat(values.neckCm)
      const hip = values.hipCm ? parseFloat(values.hipCm) : null

      await upsertBodyMetric(db, {
        profileId: profile.id,
        date: today,
        weightKg: profile.weightKg,
        waistCm: waist,
        hipCm: profile.sex === 'female' ? hip : null,
        navyWaistCm: waist,
        navyNeckCm: neck,
        bodyFatPct: liveResult.bodyFatPct,
        leanMassKg: liveResult.leanMassKg,
        fatMassKg: liveResult.fatMassKg,
      })
    },
  })

  return {
    values,
    setField,
    liveResult,
    save: () => {
      mutation.mutate()
    },
    isSaving: mutation.isPending,
    saveError: mutation.error,
    saveSuccess: mutation.isSuccess,
  }
}
