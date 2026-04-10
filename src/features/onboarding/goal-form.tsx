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
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { Button } from '@components/ui/button'
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
    title: 'Recomposition',
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
// Shared style objects
// ─────────────────────────────────────────────

const MINT_CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const

const SELECTED_ROW_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 14,
  elevation: 5,
} as const

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
    <View className="flex-1 bg-mint-100">
      {/* Soft mint gradient background */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles in the background */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 200, left: -90 }}
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* === TOP BAR: Back + step dots === */}
          <View className="flex-row items-center justify-between pt-2">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/70 active:opacity-80"
              style={MINT_CARD_SHADOW}
            >
              <Text className="font-sans-semibold text-[20px] text-mint-700" style={{ marginTop: -2 }}>
                {'\u2190'}
              </Text>
            </Pressable>

            <View
              className="flex-row items-center gap-2"
              accessibilityRole="progressbar"
              accessibilityLabel="Onboarding progress, step 2 of 3"
            >
              <View className="h-2 w-2 rounded-full bg-mint-500/40" />
              <View className="h-2 w-6 rounded-full bg-mint-500" />
              <View className="h-2 w-2 rounded-full bg-white/60" />
            </View>

            {/* Invisible spacer to keep the dots centered */}
            <View className="h-11 w-11" />
          </View>

          {/* === HEADLINE === */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              What are you{'\n'}working on?
            </Text>
            <Text
              className="font-sans text-[15px] text-slate-600 mt-3"
              style={{ lineHeight: 22 }}
            >
              Pick your goal and how active you are.
            </Text>
          </View>

          {/* === GOAL CARD === */}
          <View
            className="mt-7 rounded-3xl bg-white p-5"
            style={MINT_CARD_SHADOW}
          >
            <Text className="font-sans-medium text-[13px] text-slate-500">
              Your goal
            </Text>
            <View className="mt-3 gap-2">
              {GOAL_OPTIONS.map((option) => {
                const selected = option.value === goal
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.title}
                    onPress={() => setGoal(option.value)}
                    className={`rounded-2xl p-4 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                    style={selected ? SELECTED_ROW_SHADOW : undefined}
                  >
                    <Text
                      className={`font-sans-semibold text-[15px] ${
                        selected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {option.title}
                    </Text>
                    <Text
                      className={`font-sans text-[12px] mt-0.5 ${
                        selected ? 'text-white/85' : 'text-slate-500'
                      }`}
                    >
                      {option.subtitle}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* === ACTIVITY CARD === */}
          <View
            className="mt-4 rounded-3xl bg-white p-5"
            style={MINT_CARD_SHADOW}
          >
            <Text className="font-sans-medium text-[13px] text-slate-500">
              Activity level
            </Text>
            <View className="mt-3 gap-2">
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = option.value === activityLevel
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    onPress={() => setActivityLevel(option.value)}
                    className={`flex-row items-center justify-between rounded-2xl p-3 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                    style={selected ? SELECTED_ROW_SHADOW : undefined}
                  >
                    <Text
                      className={`font-sans-medium text-[14px] ${
                        selected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {option.label}
                    </Text>
                    <View
                      className={`rounded-full px-2 py-0.5 ${
                        selected ? 'bg-white/20' : 'bg-mint-100'
                      }`}
                    >
                      <Text
                        className={`font-sans-medium text-[11px] ${
                          selected ? 'text-white' : 'text-mint-700'
                        }`}
                      >
                        {`\u00D7${option.multiplier}`}
                      </Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* === LIVE RESULT CARD === */}
          {liveResult ? (
            <View
              className="mt-4 rounded-3xl bg-white p-5"
              style={MINT_CARD_SHADOW}
            >
              <View className="flex-row">
                <View className="flex-1">
                  <Text className="font-sans text-[12px] text-slate-500">
                    Daily energy
                  </Text>
                  <View className="mt-1 flex-row items-baseline">
                    <Text
                      className="font-sans-bold text-[28px] text-slate-900"
                      style={{ letterSpacing: -0.5 }}
                    >
                      {liveResult.tdee.toLocaleString()}
                    </Text>
                    <Text className="font-sans-medium text-[14px] text-slate-600 ml-1">
                      kcal
                    </Text>
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="font-sans text-[12px] text-slate-500">
                    Protein target
                  </Text>
                  <View className="mt-1 flex-row items-baseline">
                    <Text
                      className="font-sans-bold text-[28px] text-mint-600"
                      style={{ letterSpacing: -0.5 }}
                    >
                      {liveResult.macros.proteinG}
                    </Text>
                    <Text className="font-sans-medium text-[14px] text-slate-600 ml-1">
                      g / day
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ) : null}

          {/* === CTA === */}
          <View className="mt-8">
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
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
