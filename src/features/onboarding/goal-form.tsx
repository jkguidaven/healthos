/**
 * src/features/onboarding/goal-form.tsx
 *
 * Onboarding step 2 — goal & activity.
 *
 * Captures the user's recomposition goal and activity level, shows a live
 * TDEE + protein target card as selections change, and on continue persists
 * the goal / activity / computed macro targets back to the profile row in
 * SQLite before navigating to the API-key step.
 *
 * Layer 4 (screen). Reads the biometric fields from the Zustand profile
 * store (set by step 1); on continue writes back via the Drizzle
 * `upsertProfile` helper and re-primes the store from the saved row.
 */

import React, { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { ScreenLayout } from '@components/layouts/screen-layout'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'
import { SectionHeader } from '@components/ui/section-header'
import * as schema from '@/lib/db/schema'
import { upsertProfile } from '@/lib/db/queries/profile'
import { useProfileStore } from '@/stores/profile-store'
import { calculateBMR, calculateTDEE, type ActivityLevel } from '@/lib/formulas/tdee'
import { calculateMacroTargets, type MacroGoal } from '@/lib/formulas/macros'
import { ACTIVITY_MULTIPLIERS } from '@/lib/formulas/constants'

// ─────────────────────────────────────────────
// Static option tables
// ─────────────────────────────────────────────

interface GoalOption {
  value: MacroGoal
  title: string
  subtitle: string
}

const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    value: 'recomposition',
    title: 'Body recomposition',
    subtitle: 'Build muscle and lose fat at once',
  },
  {
    value: 'bulk',
    title: 'Bulk',
    subtitle: 'Surplus calories to maximise muscle gain',
  },
  {
    value: 'cut',
    title: 'Cut',
    subtitle: 'Deficit calories to maximise fat loss',
  },
] as const

interface ActivityOption {
  value: ActivityLevel
  label: string
  multiplier: number
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  { value: 'sedentary',   label: 'Sedentary',         multiplier: ACTIVITY_MULTIPLIERS.sedentary },
  { value: 'light',       label: 'Lightly active',    multiplier: ACTIVITY_MULTIPLIERS.light },
  { value: 'moderate',    label: 'Moderately active', multiplier: ACTIVITY_MULTIPLIERS.moderate },
  { value: 'active',      label: 'Very active',       multiplier: ACTIVITY_MULTIPLIERS.active },
  { value: 'very_active', label: 'Extremely active',  multiplier: ACTIVITY_MULTIPLIERS.very_active },
] as const

// ─────────────────────────────────────────────
// Screen component
// ─────────────────────────────────────────────

export function GoalForm(): React.ReactElement {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((s) => s.profile)
  const setProfile = useProfileStore((s) => s.setProfile)

  const [goal, setGoal] = useState<MacroGoal>('recomposition')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate')
  const [saving, setSaving] = useState(false)

  const liveResult = useMemo(() => {
    if (!profile) return null
    const bmr = calculateBMR({
      sex: profile.sex,
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
    })
    const tdee = calculateTDEE(bmr, activityLevel)
    const macros = calculateMacroTargets(tdee, profile.weightKg, goal)
    return { tdee, macros }
  }, [profile, goal, activityLevel])

  const handleContinue = async (): Promise<void> => {
    if (!profile || !liveResult) return
    setSaving(true)
    try {
      const saved = await upsertProfile(db, {
        age: profile.age,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        units: profile.units,
        experienceLevel: profile.experienceLevel,
        goal,
        activityLevel,
        goalCalories: liveResult.macros.calories,
        goalProteinG: liveResult.macros.proteinG,
        goalCarbsG: liveResult.macros.carbsG,
        goalFatG: liveResult.macros.fatG,
      })

      // Map the DB row into the slightly different Zustand store shape.
      // The store keeps `activityLevel` as the numeric multiplier.
      setProfile({
        id: saved.id,
        age: saved.age,
        sex: saved.sex,
        heightCm: saved.heightCm,
        weightKg: saved.weightKg,
        units: saved.units,
        goal: saved.goal,
        activityLevel: ACTIVITY_MULTIPLIERS[saved.activityLevel],
        goalCalories: saved.goalCalories,
        goalProteinG: saved.goalProteinG,
        goalCarbsG: saved.goalCarbsG,
        goalFatG: saved.goalFatG,
        experienceLevel: saved.experienceLevel,
      })

      router.push('/(onboarding)/api-key')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScreenLayout scroll>
      {/* Progress bar — 3 segments, 2 filled */}
      <View className="mb-3.5 mt-2 flex-row gap-1">
        <View className="h-3 flex-1 rounded-full bg-brand-green" />
        <View className="h-3 flex-1 rounded-full bg-brand-green" />
        <View className="h-3 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      </View>

      {/* Title */}
      <Text className="text-[17px] font-medium text-zinc-900 dark:text-zinc-100">
        Goal & activity
      </Text>

      {/* Subtitle */}
      <Text className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
        How you train and what you&apos;re chasing
      </Text>

      {/* Goal selector */}
      <View className="gap-1.5">
        {GOAL_OPTIONS.map((option) => {
          const selected = option.value === goal
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.title}
              onPress={() => setGoal(option.value)}
              className={
                selected
                  ? 'rounded-lg border-2 border-brand-purple bg-purple-50 p-2.5 dark:bg-purple-950'
                  : 'rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800'
              }
            >
              <Text className="text-[12px] font-medium text-zinc-900 dark:text-zinc-100">
                {option.title}
              </Text>
              <Text className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {option.subtitle}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Activity level selector */}
      <View className="mt-4">
        <SectionHeader>Activity level</SectionHeader>
        <View className="gap-1.5">
          {ACTIVITY_OPTIONS.map((option) => {
            const selected = option.value === activityLevel
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
                onPress={() => setActivityLevel(option.value)}
                className={
                  selected
                    ? 'flex-row items-center justify-between rounded-lg border border-brand-green bg-teal-50 p-2.5 dark:bg-teal-950'
                    : 'flex-row items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800'
                }
              >
                <Text className="text-[12px] text-zinc-900 dark:text-zinc-100">
                  {option.label}
                </Text>
                <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  {`\u00D7${option.multiplier}`}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Live TDEE + protein result card */}
      {liveResult ? (
        <View className="mt-4">
          <Card variant="secondary" padding="md">
            <View className="flex-row">
              <View className="flex-1">
                <Text className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
                  {liveResult.tdee.toLocaleString()}
                </Text>
                <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  kcal / day
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-[16px] font-medium text-brand-purple">
                  {liveResult.macros.proteinG}
                </Text>
                <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  g protein / day
                </Text>
              </View>
            </View>
          </Card>
        </View>
      ) : null}

      {/* CTA */}
      <View className="mt-5">
        <Button
          variant="primary"
          loading={saving}
          disabled={!profile || !liveResult}
          onPress={() => {
            void handleContinue()
          }}
        >
          Continue
        </Button>
      </View>
    </ScreenLayout>
  )
}
