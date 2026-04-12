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
 * in later phases — see `docs/project-guide.md` build plan.
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
import {
  getActivePlan,
  getPlanDays,
  getRecentSessions,
  getWeekSessionCount,
} from '@db/queries/workouts'
import { getTodayCoachEntry } from '@db/queries/coach'
import { calculateBMR, calculateTDEE } from '@/lib/formulas/tdee'
import { deriveCoachHint, type CoachHintTone } from '@formulas/coach-hint'
import { useProfileStore } from '@/stores/profile-store'
import type { MacroGoal } from '@/lib/formulas/macros'

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

  // The user's goal phase (from profile.goal) and the maintenance TDEE
  // computed live from their biometrics. The dashboard surfaces the
  // delta (goalCalories - maintenanceTdee) so the user always knows
  // whether they're in surplus / deficit / maintenance.
  goal: MacroGoal | null
  maintenanceTdee: number | null

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

  // AI coach — derived live by deriveCoachHint() so it reflects today's
  // logged data and re-evaluates whenever the dashboard refocuses.
  coachMessage: string
  /** Tone bucket for the dashboard pill (win/nudge/watch/neutral). */
  coachTone: CoachHintTone

  // Next workout — derived from the active plan. `nextWorkoutName` is the
  // day name (or null if there's no plan); the plan + day IDs let the
  // dashboard CTA navigate straight into the session logger. When the
  // IDs are null the CTA falls back to opening the workout tab.
  nextWorkoutName: string | null
  nextWorkoutPlanId: number | null
  nextWorkoutDayId: number | null

  // Today's date — formatted for the sub-header
  todayLabel: string
}

export interface UseDashboardResult {
  data: DashboardData | null
  loading: boolean
}

// ─────────────────────────────────────────────
// Tunables — kept here so the hook is the single source of truth for
// "what does the dashboard target this user against".
// ─────────────────────────────────────────────

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
            const noProfileHint = deriveCoachHint({
              hour: now.getHours(),
              hasProfile: false,
              goalCalories: 0,
              goalProteinG: 0,
              todayCalories: 0,
              todayProteinG: 0,
              mealsLogged: 0,
              todayWaterMl: 0,
              waterTarget: WATER_TARGET_ML,
              workoutsThisWeek: 0,
              workoutTarget: WORKOUT_TARGET_PER_WEEK,
              dayOfWeek: now.getDay(),
              cachedCoachMessage: null,
            })
            setData({
              greeting,
              profileName: 'there',
              hasProfile: false,
              goalCalories: 0,
              goalProteinG: 0,
              goalCarbsG: 0,
              goalFatG: 0,
              goal: null,
              maintenanceTdee: null,
              todayCalories: 0,
              todayProteinG: 0,
              todayCarbsG: 0,
              todayFatG: 0,
              todayWeightKg: null,
              workoutsThisWeek: 0,
              workoutTarget: WORKOUT_TARGET_PER_WEEK,
              todayWaterMl: 0,
              waterTarget: WATER_TARGET_ML,
              coachMessage: noProfileHint.message,
              coachTone: noProfileHint.tone,
              nextWorkoutName: null,
              nextWorkoutPlanId: null,
              nextWorkoutDayId: null,
              todayLabel,
            })
            setLoading(false)
            return
          }

          // Compute the user's maintenance TDEE live from their biometrics
          // so the dashboard can show the surplus/deficit delta against
          // the saved goalCalories.
          const bmr = calculateBMR({
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.heightCm,
            weightKg: profile.weightKg,
          })
          const maintenanceTdee = calculateTDEE(bmr, profile.activityLevel)

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

          // Pull macros + workouts + water + latest metric in parallel.
          // Also read the cached AI coach entry — used as a richer
          // fallback when no urgent rule fires in deriveCoachHint().
          // The active plan + recent sessions feed the "Today's workout"
          // CTA below; plan days are loaded in a follow-up call because
          // they depend on the plan id.
          const todayIso = new Date().toISOString().split('T')[0]
          const [
            latestMetric,
            waterRow,
            macroSummary,
            weekWorkouts,
            cachedCoach,
            activePlan,
            recentSessions,
          ] = await Promise.all([
            getLatestBodyMetric(db, profile.id),
            getTodayWaterLog(db, profile.id),
            getTodayMacroSummary(db, profile.id),
            getWeekSessionCount(db, profile.id),
            getTodayCoachEntry(db, todayIso),
            getActivePlan(db, profile.id),
            getRecentSessions(db, profile.id, 7),
          ])

          // Derive the "next workout" — first plan day whose id hasn't
          // already been logged in the last 7 days, falling back to the
          // first day in the plan when everything is done (or nothing is).
          let nextWorkoutName: string | null = null
          let nextWorkoutPlanId: number | null = null
          let nextWorkoutDayId: number | null = null

          if (activePlan != null) {
            const planDays = await getPlanDays(db, activePlan.id)
            if (planDays.length > 0) {
              const doneDayIds = new Set<number>()
              for (const s of recentSessions) {
                if (s.dayId != null) doneDayIds.add(s.dayId)
              }
              const nextDay =
                planDays.find((d) => !doneDayIds.has(d.id)) ?? planDays[0]
              nextWorkoutName = nextDay.dayName
              nextWorkoutPlanId = activePlan.id
              nextWorkoutDayId = nextDay.id
            }
          }

          if (cancelled) return

          // Derive the dashboard "Daily insight" tile from real data.
          // Re-runs on every focus, so logging food / water / workouts
          // and switching back to Home gets a fresh hint instantly.
          const hint = deriveCoachHint({
            hour: now.getHours(),
            hasProfile: true,
            goalCalories: profile.goalCalories,
            goalProteinG: profile.goalProteinG,
            todayCalories: macroSummary.calories,
            todayProteinG: macroSummary.proteinG,
            mealsLogged: macroSummary.mealsLogged,
            todayWaterMl: waterRow?.amountMl ?? 0,
            waterTarget: WATER_TARGET_ML,
            workoutsThisWeek: weekWorkouts,
            workoutTarget: WORKOUT_TARGET_PER_WEEK,
            dayOfWeek: now.getDay(),
            cachedCoachMessage: cachedCoach?.message ?? null,
          })

          setData({
            greeting,
            profileName: 'there',
            hasProfile: true,
            goalCalories: profile.goalCalories,
            goalProteinG: profile.goalProteinG,
            goalCarbsG: profile.goalCarbsG,
            goalFatG: profile.goalFatG,
            goal: profile.goal,
            maintenanceTdee,
            todayCalories: macroSummary.calories,
            todayProteinG: macroSummary.proteinG,
            todayCarbsG: macroSummary.carbsG,
            todayFatG: macroSummary.fatG,
            todayWeightKg: latestMetric?.weightKg ?? null,
            workoutsThisWeek: weekWorkouts,
            workoutTarget: WORKOUT_TARGET_PER_WEEK,
            todayWaterMl: waterRow?.amountMl ?? 0,
            waterTarget: WATER_TARGET_ML,
            coachMessage: hint.message,
            coachTone: hint.tone,
            nextWorkoutName,
            nextWorkoutPlanId,
            nextWorkoutDayId,
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
