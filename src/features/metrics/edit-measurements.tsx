/**
 * src/features/metrics/edit-measurements.tsx
 *
 * Layer 4 — Edit measurements screen.
 *
 * The user lands here to FIX a mistake in their latest body metric entry
 * (or correct their height on the profile). Pre-populates with the latest
 * row + profile height, and on save updates the existing row by id rather
 * than upserting a new one for today — so editing yesterday's entry stays
 * on yesterday's date.
 *
 * Visual language: flat white surface, rounded-3xl bordered card, mint
 * primary CTA. Same Poppins typography as the rest of the app.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import * as schema from '@db/schema'
import {
  getLatestBodyMetric,
  updateBodyMetric,
  upsertBodyMetric,
} from '@db/queries/metrics'
import { updateProfile } from '@db/queries/profile'
import { useProfileStore } from '@/stores/profile-store'
import { calculateBodyFat } from '@formulas/body-fat'

interface FormValues {
  heightCm: string
  weightKg: string
  waistCm: string
  neckCm: string
  hipCm: string
  chestCm: string
  armCm: string
  thighCm: string
}

const EMPTY_VALUES: FormValues = {
  heightCm: '',
  weightKg: '',
  waistCm: '',
  neckCm: '',
  hipCm: '',
  chestCm: '',
  armCm: '',
  thighCm: '',
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const n = Number(trimmed)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function EditMeasurementsScreen(): React.ReactElement {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])
  const profile = useProfileStore((s) => s.profile)
  const setProfileInStore = useProfileStore((s) => s.setProfile)

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES)
  const [latestId, setLatestId] = useState<number | null>(null)
  const [latestDate, setLatestDate] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load latest entry + profile height on mount
  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      if (!profile) {
        setLoading(false)
        return
      }
      const latest = await getLatestBodyMetric(db, profile.id)
      if (cancelled) return

      setLatestId(latest?.id ?? null)
      setLatestDate(latest?.date ?? null)
      setValues({
        heightCm: profile.heightCm.toString(),
        weightKg: latest?.weightKg.toString() ?? profile.weightKg.toString(),
        waistCm: latest?.waistCm?.toString() ?? '',
        neckCm: latest?.navyNeckCm?.toString() ?? '',
        hipCm: latest?.hipCm?.toString() ?? '',
        chestCm: latest?.chestCm?.toString() ?? '',
        armCm: latest?.armCm?.toString() ?? '',
        thighCm: latest?.thighCm?.toString() ?? '',
      })
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [db, profile])

  const setField = (field: keyof FormValues) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async (): Promise<void> => {
    if (!profile) return
    setSaveError(null)
    setSaving(true)
    try {
      const heightCm = parseOptionalNumber(values.heightCm)
      const weightKg = parseOptionalNumber(values.weightKg)
      if (heightCm === null) {
        setSaveError('Height is required.')
        setSaving(false)
        return
      }
      if (weightKg === null) {
        setSaveError('Weight is required.')
        setSaving(false)
        return
      }

      const waistCm = parseOptionalNumber(values.waistCm)
      const neckCm = parseOptionalNumber(values.neckCm)
      const hipCm = parseOptionalNumber(values.hipCm)
      const chestCm = parseOptionalNumber(values.chestCm)
      const armCm = parseOptionalNumber(values.armCm)
      const thighCm = parseOptionalNumber(values.thighCm)

      // 1. If height or profile weight changed, update the profile row
      // via a focused partial update — avoids round-tripping the full
      // shape through the Zustand store (which stores activityLevel as
      // a numeric multiplier, not the schema's string enum).
      if (heightCm !== profile.heightCm || weightKg !== profile.weightKg) {
        await updateProfile(db, profile.id, { heightCm, weightKg })
        setProfileInStore({
          ...profile,
          heightCm,
          weightKg,
        })
      }

      // 2. Recompute body fat % if waist + neck (+hip for female) are present.
      const bodyFatResult =
        waistCm !== null && neckCm !== null
          ? calculateBodyFat(
              {
                sex: profile.sex,
                heightCm,
                waistCm,
                neckCm,
                hipCm: profile.sex === 'female' ? (hipCm ?? undefined) : undefined,
              },
              weightKg,
            )
          : null

      // 3. Update or create the body metric entry.
      const sharedFields = {
        weightKg,
        waistCm,
        hipCm,
        chestCm,
        armCm,
        thighCm,
        navyWaistCm: waistCm,
        navyNeckCm: neckCm,
        bodyFatPct: bodyFatResult?.bodyFatPct ?? null,
        leanMassKg: bodyFatResult?.leanMassKg ?? null,
        fatMassKg: bodyFatResult?.fatMassKg ?? null,
      }

      if (latestId !== null) {
        // Edit existing row by id — preserves the original date.
        await updateBodyMetric(db, latestId, sharedFields)
      } else {
        // No body_metric exists yet — create one for today.
        await upsertBodyMetric(db, {
          profileId: profile.id,
          date: new Date().toISOString().split('T')[0],
          ...sharedFields,
        })
      }

      router.back()
    } catch (e) {
      setSaveError(
        e instanceof Error ? e.message : 'Could not save measurements.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleBack = (): void => {
    router.back()
  }

  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="font-sans-bold text-[18px] text-slate-900 mb-2">
          Profile not found
        </Text>
        <Text className="font-sans text-[13px] text-slate-600 text-center">
          Complete onboarding before editing measurements.
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top bar */}
          <View className="flex-row items-center justify-between pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
            >
              <Text className="font-sans-semibold text-[22px] text-slate-700">
                ‹
              </Text>
            </Pressable>
            <Text className="font-sans-semibold text-[18px] text-slate-900">
              Edit measurements
            </Text>
            <View className="h-10 w-10" />
          </View>

          {/* Headline */}
          <View className="mt-6">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Fix any mistakes
            </Text>
            <Text className="mt-2 font-sans text-[14px] text-slate-600">
              {latestDate
                ? `Editing entry from ${formatDate(latestDate)}.`
                : 'No entries yet — your changes will create today\u2019s entry.'}
            </Text>
          </View>

          {loading ? (
            <View className="mt-10 items-center">
              <Text className="font-sans text-[13px] text-slate-500">
                Loading…
              </Text>
            </View>
          ) : (
            <>
              {/* Profile fields */}
              <View className="mt-8 rounded-3xl border border-slate-100 bg-white p-6">
                <Text className="mb-4 font-sans-semibold text-[13px] text-slate-500">
                  Profile
                </Text>
                <Input
                  label="Height (cm)"
                  value={values.heightCm}
                  onChangeText={setField('heightCm')}
                  keyboardType="decimal-pad"
                  placeholder="175"
                />
                <View className="mt-5">
                  <Input
                    label="Weight (kg)"
                    value={values.weightKg}
                    onChangeText={setField('weightKg')}
                    keyboardType="decimal-pad"
                    placeholder="78"
                  />
                </View>
              </View>

              {/* Tape measurements */}
              <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-6">
                <Text className="mb-4 font-sans-semibold text-[13px] text-slate-500">
                  Tape measurements (cm)
                </Text>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      label="Waist"
                      value={values.waistCm}
                      onChangeText={setField('waistCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Neck"
                      value={values.neckCm}
                      onChangeText={setField('neckCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                </View>
                {profile.sex === 'female' ? (
                  <View className="mt-5">
                    <Input
                      label="Hip"
                      value={values.hipCm}
                      onChangeText={setField('hipCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                ) : (
                  <View className="mt-5">
                    <Input
                      label="Hip (optional)"
                      value={values.hipCm}
                      onChangeText={setField('hipCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                )}
                <View className="mt-5 flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      label="Chest"
                      value={values.chestCm}
                      onChangeText={setField('chestCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                  <View className="flex-1">
                    <Input
                      label="Arm"
                      value={values.armCm}
                      onChangeText={setField('armCm')}
                      keyboardType="decimal-pad"
                      placeholder="—"
                    />
                  </View>
                </View>
                <View className="mt-5">
                  <Input
                    label="Thigh"
                    value={values.thighCm}
                    onChangeText={setField('thighCm')}
                    keyboardType="decimal-pad"
                    placeholder="—"
                  />
                </View>
              </View>

              {saveError ? (
                <Text className="mt-4 font-sans text-[13px] text-brand-coral">
                  {saveError}
                </Text>
              ) : null}

              {/* Save CTA */}
              <View className="mt-8">
                <Button
                  onPress={() => {
                    void handleSave()
                  }}
                  loading={saving}
                  disabled={saving}
                >
                  Save changes
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

function formatDate(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
