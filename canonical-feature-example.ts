/**
 * CANONICAL FEATURE EXAMPLE — Body fat calculator
 *
 * This file demonstrates the full feature architecture for HealthOS.
 * Every new feature should follow this exact structure.
 *
 * Layers shown (top to bottom):
 *   1. Pure formula function       src/lib/formulas/body-fat.ts
 *   2. Drizzle query helper        src/lib/db/queries/metrics.ts  (excerpt)
 *   3. Feature hook                src/features/metrics/use-body-fat.ts
 *   4. Screen component            src/features/metrics/body-fat-form.tsx
 *
 * Agent instructions:
 * - Copy this pattern for every new feature.
 * - Layer 1 has no imports from React, Drizzle, or AI — pure TypeScript functions only.
 * - Layer 2 uses Drizzle query builder only — no raw SQL strings.
 * - Layer 3 owns all state and side-effects. The component is dumb.
 * - Layer 4 receives data via the hook — no direct DB or formula calls inside JSX.
 */

// ═══════════════════════════════════════════════════════════════
// LAYER 1 — Pure formula functions
// File: src/lib/formulas/body-fat.ts
// ═══════════════════════════════════════════════════════════════

/**
 * US Navy body fat estimation method.
 * Source: Hodgdon & Beckett (1984), US Navy PRT standards.
 *
 * Inputs in centimetres. Returns a percentage (e.g. 17.2 for 17.2%).
 * Returns null if inputs are physiologically implausible.
 */

// Constants — all magic numbers live here with source citations
const NAVY_MALE_CONST_A   = 1.0324   // Hodgdon & Beckett 1984
const NAVY_MALE_CONST_B   = 0.19077
const NAVY_MALE_CONST_C   = 0.15456
const NAVY_MALE_OFFSET    = 450
const NAVY_MALE_DIVISOR   = 495
const NAVY_FEMALE_CONST_A = 1.29579
const NAVY_FEMALE_CONST_B = 0.35004
const NAVY_FEMALE_CONST_C = 0.22100
const NAVY_FEMALE_OFFSET  = 450
const NAVY_FEMALE_DIVISOR = 495

export interface BodyFatInput {
  sex: 'male' | 'female'
  heightCm: number
  waistCm: number    // measured at navel
  neckCm: number     // measured at narrowest point below larynx
  hipCm?: number     // required for females, optional for males
}

export interface BodyFatResult {
  bodyFatPct: number
  leanMassKg: number
  fatMassKg: number
  category: BodyFatCategory
}

export type BodyFatCategory =
  | 'essential'   // < 6% male, < 14% female
  | 'athletic'    // 6–13% male, 14–20% female
  | 'fitness'     // 14–20% male, 21–24% female
  | 'average'     // 21–24% male, 25–31% female
  | 'obese'       // >= 25% male, >= 32% female

export function calculateBodyFat(
  input: BodyFatInput,
  totalWeightKg: number,
): BodyFatResult | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input

  // Input validation
  if (heightCm < 100 || heightCm > 250) return null
  if (waistCm < 40 || waistCm > 200) return null
  if (neckCm < 20 || neckCm > 80) return null
  if (sex === 'female' && (!hipCm || hipCm < 40)) return null
  if (waistCm <= neckCm) return null   // waist must be larger than neck

  let bodyFatPct: number

  if (sex === 'male') {
    const logDiff = Math.log10(waistCm - neckCm)
    const logHeight = Math.log10(heightCm)
    bodyFatPct =
      NAVY_MALE_DIVISOR /
      (NAVY_MALE_CONST_A -
        NAVY_MALE_CONST_B * logDiff +
        NAVY_MALE_CONST_C * logHeight) -
      NAVY_MALE_OFFSET
  } else {
    const logDiff = Math.log10((waistCm + hipCm!) - neckCm)
    const logHeight = Math.log10(heightCm)
    bodyFatPct =
      NAVY_FEMALE_DIVISOR /
      (NAVY_FEMALE_CONST_A -
        NAVY_FEMALE_CONST_B * logDiff +
        NAVY_FEMALE_CONST_C * logHeight) -
      NAVY_FEMALE_OFFSET
  }

  // Clamp to physiologically plausible range
  bodyFatPct = Math.min(Math.max(bodyFatPct, 3), 50)

  const fatMassKg  = (bodyFatPct / 100) * totalWeightKg
  const leanMassKg = totalWeightKg - fatMassKg

  return {
    bodyFatPct:  Math.round(bodyFatPct * 10) / 10,   // one decimal place
    leanMassKg:  Math.round(leanMassKg * 10) / 10,
    fatMassKg:   Math.round(fatMassKg * 10) / 10,
    category:    getBodyFatCategory(sex, bodyFatPct),
  }
}

function getBodyFatCategory(sex: 'male' | 'female', pct: number): BodyFatCategory {
  if (sex === 'male') {
    if (pct < 6)   return 'essential'
    if (pct < 14)  return 'athletic'
    if (pct < 21)  return 'fitness'
    if (pct < 25)  return 'average'
    return 'obese'
  } else {
    if (pct < 14)  return 'essential'
    if (pct < 21)  return 'athletic'
    if (pct < 25)  return 'fitness'
    if (pct < 32)  return 'average'
    return 'obese'
  }
}

export const BODY_FAT_CATEGORY_LABEL: Record<BodyFatCategory, string> = {
  essential: 'Essential fat',
  athletic:  'Athletic',
  fitness:   'Fitness',
  average:   'Average',
  obese:     'Above average',
}


// ═══════════════════════════════════════════════════════════════
// LAYER 2 — Drizzle query helpers
// File: src/lib/db/queries/metrics.ts  (excerpt)
// ═══════════════════════════════════════════════════════════════

import { desc, eq, gte, lte, and } from 'drizzle-orm'
import { bodyMetricTable, type BodyMetric, type NewBodyMetric } from '../schema'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

type DB = ExpoSQLiteDatabase<typeof import('../schema').schema>

/**
 * Get the most recent body metric entry for a profile.
 * Used by the metrics screen header tile.
 */
export async function getLatestBodyMetric(
  db: DB,
  profileId: number,
): Promise<BodyMetric | null> {
  const rows = await db
    .select()
    .from(bodyMetricTable)
    .where(eq(bodyMetricTable.profileId, profileId))
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Get body metrics for a date range — used for trend charts.
 * Returns rows ordered oldest-first (chart-friendly).
 */
export async function getBodyMetricsRange(
  db: DB,
  profileId: number,
  fromDate: string,   // YYYY-MM-DD
  toDate: string,     // YYYY-MM-DD
): Promise<BodyMetric[]> {
  return db
    .select()
    .from(bodyMetricTable)
    .where(
      and(
        eq(bodyMetricTable.profileId, profileId),
        gte(bodyMetricTable.date, fromDate),
        lte(bodyMetricTable.date, toDate),
      ),
    )
    .orderBy(bodyMetricTable.date)   // oldest first
}

/**
 * Upsert today's body metric entry.
 * Conflict target is (date) — only one entry per day allowed.
 */
export async function upsertBodyMetric(
  db: DB,
  entry: NewBodyMetric,
): Promise<BodyMetric> {
  const rows = await db
    .insert(bodyMetricTable)
    .values(entry)
    .onConflictDoUpdate({
      target: bodyMetricTable.date,
      set: {
        weightKg:    entry.weightKg,
        waistCm:     entry.waistCm,
        hipCm:       entry.hipCm,
        chestCm:     entry.chestCm,
        armCm:       entry.armCm,
        thighCm:     entry.thighCm,
        bodyFatPct:  entry.bodyFatPct,
        leanMassKg:  entry.leanMassKg,
        fatMassKg:   entry.fatMassKg,
        navyWaistCm: entry.navyWaistCm,
        navyNeckCm:  entry.navyNeckCm,
      },
    })
    .returning()
  return rows[0]
}


// ═══════════════════════════════════════════════════════════════
// LAYER 3 — Feature hook
// File: src/features/metrics/use-body-fat.ts
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useProfileStore } from '../../stores/profile-store'
import { calculateBodyFat, type BodyFatResult } from '../../lib/formulas/body-fat'
import { upsertBodyMetric } from '../../lib/db/queries/metrics'
import * as schema from '../../lib/db/schema'

export interface BodyFatFormValues {
  waistCm: string
  neckCm: string
  hipCm: string     // only used if sex === 'female'
}

export interface UseBodyFatReturn {
  // Form state
  values: BodyFatFormValues
  setField: (field: keyof BodyFatFormValues, value: string) => void

  // Live calculation result (updates as user types)
  liveResult: BodyFatResult | null

  // Save mutation
  save: () => void
  isSaving: boolean
  saveError: Error | null
  saveSuccess: boolean
}

export function useBodyFat(): UseBodyFatReturn {
  const sqlite   = useSQLiteContext()
  const db       = drizzle(sqlite, { schema })
  const profile  = useProfileStore((s) => s.profile)

  const today    = new Date().toISOString().split('T')[0]  // YYYY-MM-DD

  const [values, setValues] = useState<BodyFatFormValues>({
    waistCm: '',
    neckCm:  '',
    hipCm:   '',
  })

  const setField = useCallback(
    (field: keyof BodyFatFormValues, value: string) => {
      setValues((prev) => ({ ...prev, [field]: value }))
    },
    [],
  )

  // Live result — recompute whenever any field changes
  const liveResult: BodyFatResult | null = (() => {
    if (!profile) return null
    const waist  = parseFloat(values.waistCm)
    const neck   = parseFloat(values.neckCm)
    const hip    = parseFloat(values.hipCm)
    if (isNaN(waist) || isNaN(neck)) return null
    if (profile.sex === 'female' && isNaN(hip)) return null

    return calculateBodyFat(
      {
        sex:      profile.sex,
        heightCm: profile.heightCm,
        waistCm:  waist,
        neckCm:   neck,
        hipCm:    profile.sex === 'female' ? hip : undefined,
      },
      profile.weightKg,
    )
  })()

  // Save mutation — writes to SQLite via Drizzle
  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile || !liveResult) throw new Error('No result to save')

      await upsertBodyMetric(db, {
        profileId:   profile.id,
        date:        today,
        weightKg:    profile.weightKg,
        waistCm:     values.waistCm ? parseFloat(values.waistCm) : null,
        hipCm:       values.hipCm   ? parseFloat(values.hipCm)   : null,
        navyWaistCm: parseFloat(values.waistCm),
        navyNeckCm:  parseFloat(values.neckCm),
        bodyFatPct:  liveResult.bodyFatPct,
        leanMassKg:  liveResult.leanMassKg,
        fatMassKg:   liveResult.fatMassKg,
      })
    },
  })

  return {
    values,
    setField,
    liveResult,
    save:        mutation.mutate,
    isSaving:    mutation.isPending,
    saveError:   mutation.error,
    saveSuccess: mutation.isSuccess,
  }
}


// ═══════════════════════════════════════════════════════════════
// LAYER 4 — Screen component
// File: src/features/metrics/body-fat-form.tsx
// ═══════════════════════════════════════════════════════════════

import React, { useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useBodyFat } from './use-body-fat'
import { useProfileStore } from '../../stores/profile-store'
import { BODY_FAT_CATEGORY_LABEL } from '../../lib/formulas/body-fat'

export function BodyFatForm() {
  const profile = useProfileStore((s) => s.profile)
  const {
    values,
    setField,
    liveResult,
    save,
    isSaving,
    saveSuccess,
  } = useBodyFat()

  // Navigate back on successful save
  useEffect(() => {
    if (saveSuccess) router.back()
  }, [saveSuccess])

  if (!profile) return null

  return (
    <View className="flex-1 bg-white px-4 pt-4">

      {/* Header */}
      <Text className="text-[15px] font-medium text-zinc-900 mb-1">
        Body fat calculator
      </Text>
      <Text className="text-[11px] text-zinc-500 mb-4">
        US Navy method
      </Text>

      {/* Input fields */}
      <View className="gap-y-2 mb-4">
        <MeasurementInput
          label="Waist (cm)"
          value={values.waistCm}
          onChangeText={(v) => setField('waistCm', v)}
          hint="At navel level"
        />
        <MeasurementInput
          label="Neck (cm)"
          value={values.neckCm}
          onChangeText={(v) => setField('neckCm', v)}
          hint="Narrowest point, below larynx"
        />
        {profile.sex === 'female' && (
          <MeasurementInput
            label="Hip (cm)"
            value={values.hipCm}
            onChangeText={(v) => setField('hipCm', v)}
            hint="At widest point"
          />
        )}
      </View>

      {/* Instruction card */}
      <View className="bg-amber-50 rounded-lg p-3 mb-4">
        <Text className="text-[10px] text-amber-800 leading-[1.5]">
          Measure waist at navel level. Neck at narrowest point below larynx. Stand straight, exhale normally.
        </Text>
      </View>

      {/* Live result card */}
      {liveResult && (
        <View className="bg-purple-50 rounded-lg p-4 mb-4 items-center">
          <Text className="text-[10px] text-purple-700 mb-1">Estimated body fat</Text>
          <Text className="text-[28px] font-medium text-purple-900">
            {liveResult.bodyFatPct}%
          </Text>
          <Text className="text-[10px] text-purple-700 mt-1">
            Lean mass: {liveResult.leanMassKg}kg · Fat mass: {liveResult.fatMassKg}kg
          </Text>
          <Text className="text-[10px] text-purple-600 mt-0.5">
            Category: {BODY_FAT_CATEGORY_LABEL[liveResult.category]}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View className="flex-row gap-x-3">
        <TouchableOpacity
          className="flex-1 bg-zinc-100 rounded-lg py-3 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-[12px] text-zinc-600">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 rounded-lg py-3 items-center ${
            liveResult && !isSaving ? 'bg-purple-600' : 'bg-purple-200'
          }`}
          onPress={save}
          disabled={!liveResult || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-[12px] font-medium text-white">Save to log</Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  )
}

// ─── Sub-component: measurement input field ───

interface MeasurementInputProps {
  label: string
  value: string
  onChangeText: (v: string) => void
  hint?: string
}

function MeasurementInput({ label, value, onChangeText, hint }: MeasurementInputProps) {
  return (
    <View>
      <Text className="text-[10px] text-zinc-400 mb-1">{label}</Text>
      <TextInput
        className="bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-[13px] font-medium text-zinc-900"
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#a1a1aa"
        returnKeyType="next"
      />
      {hint && (
        <Text className="text-[9px] text-zinc-400 mt-1">{hint}</Text>
      )}
    </View>
  )
}
