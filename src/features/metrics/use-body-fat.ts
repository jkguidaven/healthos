/**
 * src/features/metrics/use-body-fat.ts
 *
 * Layer 3 — Feature hook for the daily check-in screen.
 *
 * Despite the name (which dates back to when the screen was a pure
 * body fat calculator), this hook now handles the broader "log
 * today's weigh-in" flow:
 *
 *   - Weight is REQUIRED. The user can save with just a weight.
 *   - Waist + Neck (+ Hip for women) are OPTIONAL. When all three
 *     are present, the Navy body fat formula runs live and the
 *     result is persisted alongside the weight. Otherwise body fat
 *     fields are stored as null.
 *
 * Pre-fills weight from the latest body_metric (or the profile as a
 * fallback) so the user doesn't retype it every day.
 *
 * The screen component is dumb — it only calls into this hook. No
 * raw SQL, no direct fetch, no `any`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from '@db/schema'
import { getLatestBodyMetric, upsertBodyMetric } from '@db/queries/metrics'
import {
  calculateBodyFat,
  type BodyFatResult,
} from '@formulas/body-fat'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

export interface BodyFatFormValues {
  weightKg: string
  waistCm: string
  neckCm: string
  hipCm: string // only consumed when profile.sex === 'female'
}

export interface UseBodyFatReturn {
  values: BodyFatFormValues
  setField: (field: keyof BodyFatFormValues, value: string) => void

  /** Live body fat result, only when all body fat fields are present. */
  liveResult: BodyFatResult | null
  /** True when the save button should be enabled (i.e. weight is valid). */
  canSave: boolean

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
    weightKg: '',
    waistCm: '',
    neckCm: '',
    hipCm: '',
  })

  // Pre-fill weight (and the optional fields) from the most recent
  // body_metric row so the user doesn't have to retype yesterday's
  // numbers. Falls back to the onboarding profile weight if there
  // is no body_metric history yet.
  useEffect(() => {
    if (!profile) return
    let cancelled = false

    void (async () => {
      const latest = await getLatestBodyMetric(db, profile.id)
      if (cancelled) return
      setValues((prev) => ({
        ...prev,
        weightKg: latest?.weightKg.toString() ?? profile.weightKg.toString(),
        waistCm: latest?.waistCm?.toString() ?? '',
        neckCm: latest?.navyNeckCm?.toString() ?? '',
        hipCm: latest?.hipCm?.toString() ?? '',
      }))
    })()

    return () => {
      cancelled = true
    }
  }, [db, profile])

  const setField = useCallback(
    (field: keyof BodyFatFormValues, value: string): void => {
      setValues((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  // Live body fat — only when all three (or four for female) fields are present.
  const liveResult = useMemo<BodyFatResult | null>(() => {
    if (!profile) return null

    const weight = parseFloat(values.weightKg)
    const waist = parseFloat(values.waistCm)
    const neck = parseFloat(values.neckCm)
    const hip = parseFloat(values.hipCm)

    if (Number.isNaN(weight)) return null
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
      weight,
    )
  }, [profile, values])

  // Save is allowed as soon as weight is a valid number — body fat fields are optional.
  const canSave = useMemo<boolean>(() => {
    const weight = parseFloat(values.weightKg)
    return !Number.isNaN(weight) && weight > 0
  }, [values.weightKg])

  // Save mutation — upserts today's row via the Drizzle query helper.
  const mutation = useMutation<void, Error, void>({
    mutationFn: async (): Promise<void> => {
      if (!profile)
        throw new Error('Profile missing — finish onboarding first')

      const weight = parseFloat(values.weightKg)
      if (Number.isNaN(weight) || weight <= 0) {
        throw new Error('Enter a valid weight')
      }

      const today = new Date().toISOString().split('T')[0]
      const waist = parseOptional(values.waistCm)
      const neck = parseOptional(values.neckCm)
      const hip = parseOptional(values.hipCm)

      await upsertBodyMetric(db, {
        profileId: profile.id,
        date: today,
        weightKg: weight,
        waistCm: waist,
        hipCm: profile.sex === 'female' ? hip : null,
        navyWaistCm: waist,
        navyNeckCm: neck,
        bodyFatPct: liveResult?.bodyFatPct ?? null,
        leanMassKg: liveResult?.leanMassKg ?? null,
        fatMassKg: liveResult?.fatMassKg ?? null,
      })
    },
  })

  return {
    values,
    setField,
    liveResult,
    canSave,
    save: () => {
      mutation.mutate()
    },
    isSaving: mutation.isPending,
    saveError: mutation.error,
    saveSuccess: mutation.isSuccess,
  }
}

function parseOptional(raw: string): number | null {
  const v = parseFloat(raw)
  return Number.isFinite(v) && v > 0 ? v : null
}
