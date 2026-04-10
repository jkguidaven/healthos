/**
 * src/features/workout/use-workout-plan-view.ts
 *
 * Layer 3 — feature hook for the workout tab's pre-session plan view.
 *
 * Loads the user's active workout plan from SQLite, then fans out to fetch
 * each day's exercises. The muscle_groups column is JSON-encoded text, so
 * the hook parses it up-front and hands the screen a clean string array.
 *
 * Uses `useFocusEffect` (not `useEffect`) so the view re-fetches whenever
 * the user navigates back from the plan generator modal — matches the
 * pattern used in `use-dashboard.ts` / `use-food-log.ts`.
 */

import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from '@db/schema'
import {
  getActivePlan,
  getPlanDays,
  getPlanDayExercises,
  getRecentSessions,
} from '@db/queries/workouts'
import type { PlanExercise, Session, WorkoutDay, WorkoutPlan } from '@db/schema'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface PlanDayWithExercises {
  day: WorkoutDay
  /** Parsed from the JSON-encoded `muscle_groups` column. */
  muscleGroups: string[]
  exercises: PlanExercise[]
}

export interface WorkoutPlanViewData {
  plan: WorkoutPlan | null
  days: PlanDayWithExercises[]
  /** Completed sessions in the last 30 days, newest first. */
  recentSessions: Session[]
  /** Set of dayIds that the user has completed at least once in the last 7 days. */
  recentlyCompletedDayIds: Set<number>
}

export interface UseWorkoutPlanViewResult {
  data: WorkoutPlanViewData
  loading: boolean
  refresh: () => Promise<void>
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Parse the JSON-encoded `muscle_groups` TEXT column into a string array.
 * Gracefully handles malformed rows — returns an empty array rather than
 * letting a bad insert crash the whole tab.
 */
export function parseMuscleGroups(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}

const EMPTY_DATA: WorkoutPlanViewData = {
  plan: null,
  days: [],
  recentSessions: [],
  recentlyCompletedDayIds: new Set(),
}

function isWithinDays(isoDate: string | null, days: number): boolean {
  if (!isoDate) return false
  const ts = Date.parse(isoDate)
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < days * 24 * 60 * 60 * 1000
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useWorkoutPlanView(): UseWorkoutPlanViewResult {
  const sqlite = useSQLiteContext()
  const profile = useProfileStore((s) => s.profile)
  const profileId = profile?.id ?? null

  const [data, setData] = useState<WorkoutPlanViewData>(EMPTY_DATA)
  const [loading, setLoading] = useState<boolean>(true)

  const load = useCallback(
    async (cancelledRef: { current: boolean }): Promise<void> => {
      const db = drizzle(sqlite, { schema })

      if (profileId == null) {
        if (cancelledRef.current) return
        setData(EMPTY_DATA)
        setLoading(false)
        return
      }

      try {
        const [plan, recentSessions] = await Promise.all([
          getActivePlan(db, profileId),
          getRecentSessions(db, profileId, 30),
        ])

        // Build the set of dayIds completed in the last 7 days for the
        // "done this week" badge on the plan day cards.
        const recentlyCompletedDayIds = new Set<number>()
        for (const s of recentSessions) {
          if (s.dayId != null && isWithinDays(s.completedAt, 7)) {
            recentlyCompletedDayIds.add(s.dayId)
          }
        }

        if (plan == null) {
          if (cancelledRef.current) return
          setData({
            plan: null,
            days: [],
            recentSessions,
            recentlyCompletedDayIds,
          })
          return
        }

        const days = await getPlanDays(db, plan.id)

        // Fetch exercises for each day sequentially — ~3-6 days per plan,
        // so the extra round-trips are negligible and the code stays flat.
        const daysWithExercises: PlanDayWithExercises[] = []
        for (const day of days) {
          const exercises = await getPlanDayExercises(db, day.id)
          daysWithExercises.push({
            day,
            muscleGroups: parseMuscleGroups(day.muscleGroups),
            exercises,
          })
        }

        if (cancelledRef.current) return
        setData({
          plan,
          days: daysWithExercises,
          recentSessions,
          recentlyCompletedDayIds,
        })
      } finally {
        if (!cancelledRef.current) setLoading(false)
      }
    },
    [sqlite, profileId],
  )

  // useFocusEffect re-runs every time the workout tab becomes focused, so
  // finishing the generate modal and popping back refreshes the view.
  useFocusEffect(
    useCallback(() => {
      const cancelledRef = { current: false }
      setLoading(true)
      void load(cancelledRef)
      return () => {
        cancelledRef.current = true
      }
    }, [load]),
  )

  // Manual refresh — exposed for callers that need to force a reload
  // outside the focus lifecycle (e.g. explicit refetch after an action).
  const refresh = useCallback(async (): Promise<void> => {
    const cancelledRef = { current: false }
    setLoading(true)
    await load(cancelledRef)
  }, [load])

  return { data, loading, refresh }
}
