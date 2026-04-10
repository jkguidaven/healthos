/**
 * src/features/dashboard/use-dashboard.ts
 *
 * Layer 3 — feature hook that powers the Dashboard home tab.
 *
 * Pulls the single profile row and the most recent body metric entry from
 * SQLite on mount, syncs the profile into the Zustand store if it isn't
 * already primed, and produces a `DashboardData` snapshot the screen can
 * render directly. All food / water / workout / coach values are currently
 * stubbed to 0 (or friendly fallbacks) because the underlying queries live
 * in later phases — see `HEALTHOS_PROJECT_GUIDE.md` build plan.
 *
 * The hook is intentionally a light read — no writes, no AI calls — so it
 * can re-run cheaply whenever the tab comes into focus.
 */

import { useCallback, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import { useFocusEffect } from 'expo-router'
import * as schema from '@db/schema'
import { getProfile } from '@db/queries/profile'
import { getLatestBodyMetric } from '@db/queries/metrics'
import { getTodayMacroSummary } from '@db/queries/food-log'
import { getTodayWaterLog } from '@db/queries/water-log'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape returned by the hook.
// Every number is either a real SQLite read or a safe zero-default so the
// UI can render intentional empty states instead of "loading…" forever.
// ─────────────────────────────────────────────

export interface DashboardData {
  greeting: string
  profileName: string
  hasProfile: boolean

  // Targets (from profile row)
  goalCalories: number
  goalProteinG: number
  goalCarbsG: number
  goalFatG: number

  // Today's totals — all 0 until Phase 2 food query lands
  todayCalories: number
  todayProteinG: number
  todayCarbsG: number
  todayFatG: number

  // Body
  todayWeightKg: number | null

  // Workouts — stubbed until Phase 3 session queries land
  workoutsThisWeek: number
  workoutTarget: number

  // Water — stubbed until Phase 2 water query lands
  todayWaterMl: number
  waterTarget: number

  // AI coach — stubbed until Phase 5 coach queries land
  coachMessage: string

  // Next workout — stubbed until Phase 3 plan queries land
  nextWorkoutName: string | null

  // Today's date — formatted for the sub-header
  todayLabel: string
}

export interface UseDashboardResult {
  data: DashboardData | null
  loading: boolean
}

// ─────────────────────────────────────────────
// Static copy — picked over hardcoding in the screen so the hook is the
// single source of truth for "what does the dashboard say today".
// ─────────────────────────────────────────────

const COACH_MESSAGES_WELCOME = [
  'Welcome in. Your daily insight will appear here once you start logging.',
  'Log your first meal to unlock your daily coach note.',
] as const

const COACH_MESSAGES_RETURNING = [
  'Steady wins. Keep logging and your coach will spot the patterns worth knowing.',
  'A new day. Start with breakfast and let the rest follow.',
] as const

const WATER_TARGET_ML = 2_500
const WORKOUT_TARGET_PER_WEEK = 4

// ─────────────────────────────────────────────
// Small pure helpers — exported so they can be unit tested later without
// standing up a full SQLite instance.
// ─────────────────────────────────────────────

export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatTodayLabel(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function pickCoachMessage(hasProfile: boolean, seed: number): string {
  const bucket = hasProfile ? COACH_MESSAGES_RETURNING : COACH_MESSAGES_WELCOME
  return bucket[seed % bucket.length]
}

// ─────────────────────────────────────────────
// The hook itself.
// ─────────────────────────────────────────────

export function useDashboard(): UseDashboardResult {
  const sqlite = useSQLiteContext()
  const setProfileInStore = useProfileStore((s) => s.setProfile)
  const profileInStore = useProfileStore((s) => s.profile)

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // useFocusEffect re-runs every time the dashboard tab becomes focused, so
  // logging food on the food tab and switching back here picks up the new
  // totals immediately. The cleanup cancels in-flight loads on tab switch.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false
      const db = drizzle(sqlite, { schema })

      const load = async (): Promise<void> => {
        const now = new Date()
        const greeting = greetingForHour(now.getHours())
        const todayLabel = formatTodayLabel(now)

        try {
          const profile = await getProfile(db)

          if (profile == null) {
            if (cancelled) return
            setData({
              greeting,
              profileName: 'there',
              hasProfile: false,
              goalCalories: 0,
              goalProteinG: 0,
              goalCarbsG: 0,
              goalFatG: 0,
              todayCalories: 0,
              todayProteinG: 0,
              todayCarbsG: 0,
              todayFatG: 0,
              todayWeightKg: null,
              workoutsThisWeek: 0,
              workoutTarget: WORKOUT_TARGET_PER_WEEK,
              todayWaterMl: 0,
              waterTarget: WATER_TARGET_ML,
              coachMessage: pickCoachMessage(false, now.getDate()),
              nextWorkoutName: null,
              todayLabel,
            })
            setLoading(false)
            return
          }

          // Prime the Zustand store on first read this session.
          if (profileInStore == null) {
            setProfileInStore({
              id: profile.id,
              age: profile.age,
              sex: profile.sex,
              heightCm: profile.heightCm,
              weightKg: profile.weightKg,
              units: profile.units,
              goal: profile.goal,
              activityLevel: 0,
              goalCalories: profile.goalCalories,
              goalProteinG: profile.goalProteinG,
              goalCarbsG: profile.goalCarbsG,
              goalFatG: profile.goalFatG,
              experienceLevel: profile.experienceLevel,
            })
          }

          const [latestMetric, waterRow, macroSummary] = await Promise.all([
            getLatestBodyMetric(db, profile.id),
            getTodayWaterLog(db, profile.id),
            getTodayMacroSummary(db, profile.id),
          ])

          if (cancelled) return

          setData({
            greeting,
            profileName: 'there',
            hasProfile: true,
            goalCalories: profile.goalCalories,
            goalProteinG: profile.goalProteinG,
            goalCarbsG: profile.goalCarbsG,
            goalFatG: profile.goalFatG,
            todayCalories: macroSummary.calories,
            todayProteinG: macroSummary.proteinG,
            todayCarbsG: macroSummary.carbsG,
            todayFatG: macroSummary.fatG,
            todayWeightKg: latestMetric?.weightKg ?? null,
            workoutsThisWeek: 0,
            workoutTarget: WORKOUT_TARGET_PER_WEEK,
            todayWaterMl: waterRow?.amountMl ?? 0,
            waterTarget: WATER_TARGET_ML,
            coachMessage: pickCoachMessage(true, now.getDate()),
            nextWorkoutName: null,
            todayLabel,
          })
        } finally {
          if (!cancelled) setLoading(false)
        }
      }

      void load()
      return () => {
        cancelled = true
      }
      // We intentionally don't depend on profileInStore — it would cause a
      // render loop after the prime.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sqlite]),
  )

  return { data, loading }
}
