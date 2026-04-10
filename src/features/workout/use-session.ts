/**
 * src/features/workout/use-session.ts
 *
 * Layer 3 — feature hook for the active workout session logger (#48).
 *
 * Owns all state + persistence for an in-progress session:
 *   - Starts a new session row in SQLite OR resumes an existing one
 *     (via `getActiveSession`) if the user reopens the app mid-workout.
 *   - Loads the day's planned exercises and any already-logged sets.
 *   - Derives the "active" exercise from the data — the first one whose
 *     logged set count is still below its planned set count.
 *   - Logs a new set (weightKg + reps) through `logSet`, then refreshes
 *     the session set list so the derived `activeExerciseIndex` advances.
 *   - Ticks an elapsed-seconds counter every second (from `session.startedAt`
 *     so backgrounding + remount stays accurate).
 *   - Exposes `finish()` / `abandon()` for the screen to drive navigation.
 *
 * This hook is NOT responsible for navigation — the screen decides where to
 * go after `finish()` / `abandon()` resolves.
 *
 * Hard rules: no `any`, no raw SQL (queries live in `@db/queries/workouts`),
 * and the elapsed timer is derived from `session.startedAt` so it survives
 * re-mounts without drifting.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import type { PlanExercise, Session, SessionSet } from '@db/schema'
import {
  completeSession,
  getActiveSession,
  getPlanDayExercises,
  getSessionSets,
  logSet,
  startSession,
} from '@db/queries/workouts'
import { useProfileStore } from '@/stores/profile-store'
import { useSessionStore } from '@/stores/session-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface ExerciseWithSets {
  exercise: PlanExercise
  /** Sets logged so far for this exercise, ordered by `setNumber` ascending. */
  loggedSets: SessionSet[]
  /** Count of sets still to log (planned - logged, clamped at 0). */
  pendingCount: number
  /** True when `loggedSets.length >= exercise.sets`. */
  isComplete: boolean
}

export type SessionErrorKind = 'no-profile' | 'no-exercises' | 'not-found' | 'unknown'

export interface SessionError {
  kind: SessionErrorKind
  message: string
}

export interface SessionData {
  session: Session | null
  exercises: ExerciseWithSets[]
  /** Index into `exercises` of the first incomplete exercise, or
   *  `exercises.length` if all are complete. */
  activeExerciseIndex: number
  /** True when every planned set of every exercise has been logged. */
  isAllComplete: boolean
  /** Seconds elapsed since `session.startedAt`. Ticks every second. */
  elapsedSeconds: number
}

export interface UseSessionReturn {
  data: SessionData
  loading: boolean
  error: SessionError | null
  /** Whether `startOrResume` is currently in flight. */
  starting: boolean
  /** Whether a `logActiveSet` or `finish` call is currently in flight. */
  isLogging: boolean
  /**
   * Start a new session for the given plan + day OR resume an existing
   * in-progress session if one is already active for this profile. Safe to
   * call multiple times — it short-circuits once a session is loaded.
   */
  startOrResume: (planId: number, dayId: number) => Promise<void>
  /**
   * Log the active set (the next pending set of the currently active
   * exercise) with the given weight + reps. Advances the active exercise
   * automatically when the last set of one is logged.
   */
  logActiveSet: (weightKg: number | null, reps: number) => Promise<void>
  /**
   * Mark the session complete (sets `completedAt = now`) and clear the
   * in-memory Zustand pointer. The caller is responsible for navigation.
   */
  finish: () => Promise<void>
  /**
   * Leave the session without marking it complete — the row stays in the
   * DB with `completedAt: null` so the user can resume later via
   * `getActiveSession`. Clears only the in-memory Zustand pointer.
   */
  abandon: () => void
}

// ─────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────

const EMPTY_EXERCISES: ExerciseWithSets[] = []

/**
 * Group logged sets by their `planExerciseId`, returning a new array of
 * `ExerciseWithSets` aligned with the planned exercises list.
 */
function buildExercisesWithSets(
  exercises: readonly PlanExercise[],
  allSets: readonly SessionSet[],
): ExerciseWithSets[] {
  const byExerciseId = new Map<number, SessionSet[]>()
  for (const set of allSets) {
    if (set.planExerciseId == null) continue
    const bucket = byExerciseId.get(set.planExerciseId)
    if (bucket) {
      bucket.push(set)
    } else {
      byExerciseId.set(set.planExerciseId, [set])
    }
  }

  // Sort each bucket by setNumber so the UI renders them in order even if
  // `loggedAt` is equal down to the millisecond (unlikely but defensible).
  for (const bucket of byExerciseId.values()) {
    bucket.sort((a, b) => a.setNumber - b.setNumber)
  }

  return exercises.map<ExerciseWithSets>((exercise) => {
    const loggedSets = byExerciseId.get(exercise.id) ?? []
    const pendingCount = Math.max(exercise.sets - loggedSets.length, 0)
    return {
      exercise,
      loggedSets,
      pendingCount,
      isComplete: loggedSets.length >= exercise.sets,
    }
  })
}

/**
 * Parse an ISO datetime string into a millisecond timestamp. Returns
 * `Date.now()` as a fallback so a bad column can't break the timer.
 */
function parseStartedAt(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Date.now()
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useSession(): UseSessionReturn {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profileId = useProfileStore((s) => s.profile?.id ?? null)
  const storeStart = useSessionStore((s) => s.startSession)
  const storeEnd = useSessionStore((s) => s.endSession)
  const storeUpdate = useSessionStore((s) => s.updateCompletedSets)

  const [session, setSession] = useState<Session | null>(null)
  const [exercises, setExercises] = useState<PlanExercise[]>([])
  const [loggedSets, setLoggedSets] = useState<SessionSet[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [starting, setStarting] = useState<boolean>(false)
  const [isLogging, setIsLogging] = useState<boolean>(false)
  const [error, setError] = useState<SessionError | null>(null)

  // Guard so `startOrResume` is safe to call twice (StrictMode, re-renders).
  const initialisedRef = useRef<boolean>(false)

  // ─────────────────────────────────────────────
  // Derived data
  // ─────────────────────────────────────────────

  const exercisesWithSets = useMemo<ExerciseWithSets[]>(() => {
    if (exercises.length === 0) return EMPTY_EXERCISES
    return buildExercisesWithSets(exercises, loggedSets)
  }, [exercises, loggedSets])

  const activeExerciseIndex = useMemo<number>(() => {
    const idx = exercisesWithSets.findIndex((e) => !e.isComplete)
    return idx === -1 ? exercisesWithSets.length : idx
  }, [exercisesWithSets])

  const isAllComplete =
    exercisesWithSets.length > 0 &&
    activeExerciseIndex === exercisesWithSets.length

  // ─────────────────────────────────────────────
  // Elapsed timer — derived from startedAt so it survives remount.
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (session == null) {
      setElapsedSeconds(0)
      return
    }
    const startMs = parseStartedAt(session.startedAt)
    const tick = (): void => {
      const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      setElapsedSeconds(diff)
    }
    tick()
    const intervalId = setInterval(tick, 1000)
    return () => clearInterval(intervalId)
  }, [session])

  // ─────────────────────────────────────────────
  // Keep the Zustand session-store in sync so other screens (dashboard,
  // workout tab) can show "resume session" affordances without re-querying.
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (session == null) return
    // Patch the completed-sets count on the Zustand store so other
    // surfaces (dashboard, tab bar) can show progress without re-querying.
    storeUpdate(loggedSets.length)
    // Intentionally scoped to just `loggedSets.length` + `session?.id` —
    // startOrResume is responsible for the initial full payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedSets.length, session?.id])

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  const loadExercisesAndSets = useCallback(
    async (dayId: number, sessionId: number): Promise<PlanExercise[]> => {
      const [planExercises, sets] = await Promise.all([
        getPlanDayExercises(db, dayId),
        getSessionSets(db, sessionId),
      ])
      setExercises(planExercises)
      setLoggedSets(sets)
      return planExercises
    },
    [db],
  )

  const startOrResume = useCallback<UseSessionReturn['startOrResume']>(
    async (planId, dayId) => {
      if (initialisedRef.current) return
      initialisedRef.current = true

      if (profileId == null) {
        setError({
          kind: 'no-profile',
          message: 'Finish onboarding before starting a session.',
        })
        return
      }

      setStarting(true)
      setLoading(true)
      setError(null)

      try {
        // Prefer an already-active session for this profile — if the user
        // closed the app mid-workout we want to pick up where they left off.
        const existing = await getActiveSession(db, profileId)
        let active: Session
        if (
          existing != null &&
          existing.planId === planId &&
          existing.dayId === dayId
        ) {
          active = existing
        } else if (existing != null) {
          // An active session exists but for a different day. Respect the
          // user's explicit "Begin" tap — leave the old one open for later
          // and create a new one for the requested day.
          active = await startSession(db, planId, dayId)
        } else {
          active = await startSession(db, planId, dayId)
        }

        const planExercises = await loadExercisesAndSets(dayId, active.id)

        if (planExercises.length === 0) {
          setError({
            kind: 'no-exercises',
            message: 'This day has no exercises planned yet.',
          })
          setSession(active)
          return
        }

        setSession(active)

        const totalSets = planExercises.reduce((sum, ex) => sum + ex.sets, 0)
        storeStart({
          sessionId: active.id,
          planId,
          dayId,
          dayName: active.name,
          startedAt: active.startedAt,
          completedSets: 0,
          totalSets,
        })
      } catch (err) {
        // Allow a retry on failure.
        initialisedRef.current = false
        setError({
          kind: 'unknown',
          message:
            err instanceof Error
              ? err.message
              : 'Something went wrong starting your session.',
        })
      } finally {
        setStarting(false)
        setLoading(false)
      }
    },
    [db, loadExercisesAndSets, profileId, storeStart],
  )

  const logActiveSet = useCallback<UseSessionReturn['logActiveSet']>(
    async (weightKg, reps) => {
      if (session == null || isLogging) return
      const activeEntry = exercisesWithSets[activeExerciseIndex]
      if (activeEntry == null || activeEntry.isComplete) return

      setIsLogging(true)
      try {
        const nextSetIndex = activeEntry.loggedSets.length // 0-based
        await logSet(db, {
          sessionId: session.id,
          exerciseId: activeEntry.exercise.id,
          setIndex: nextSetIndex,
          weightKg,
          reps,
        })
        // Re-fetch all sets for the session — cheap (dozens of rows at most)
        // and avoids having to stitch the new row into local state by hand.
        const refreshed = await getSessionSets(db, session.id)
        setLoggedSets(refreshed)
      } finally {
        setIsLogging(false)
      }
    },
    [db, session, isLogging, exercisesWithSets, activeExerciseIndex],
  )

  const finish = useCallback<UseSessionReturn['finish']>(async () => {
    if (session == null || isLogging) return
    setIsLogging(true)
    try {
      await completeSession(db, session.id)
      storeEnd()
    } finally {
      setIsLogging(false)
    }
  }, [db, session, isLogging, storeEnd])

  const abandon = useCallback<UseSessionReturn['abandon']>(() => {
    storeEnd()
  }, [storeEnd])

  // ─────────────────────────────────────────────
  // Return shape
  // ─────────────────────────────────────────────

  const data: SessionData = {
    session,
    exercises: exercisesWithSets,
    activeExerciseIndex,
    isAllComplete,
    elapsedSeconds,
  }

  return {
    data,
    loading,
    error,
    starting,
    isLogging,
    startOrResume,
    logActiveSet,
    finish,
    abandon,
  }
}
