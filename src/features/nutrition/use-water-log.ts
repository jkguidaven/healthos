/**
 * src/features/nutrition/use-water-log.ts
 *
 * Feature hook for water intake tracking.
 *
 * Owns all data access for the water tracker screen and the dashboard
 * mini-stat:
 *   - reads today's water total from SQLite (via Drizzle)
 *   - exposes `add(ml)` and `setTotal(ml)` mutations that persist then
 *     re-fetch so consumers always see the live total
 *   - computes the percent complete (0-100) against a fixed goal
 *
 * Kept deliberately thin — no formatting, no UI concerns. The daily goal
 * is hardcoded at 2500 mL for now; future iterations may lift it into the
 * profile row.
 *
 * If the profile hasn't been created yet we return an empty shape so the
 * dashboard can render its zero-state without crashing.
 */

import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import {
  addWater,
  getTodayWaterLog,
  setTodayWater,
} from '@db/queries/water-log'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface WaterLogData {
  todayMl: number
  /** Daily goal in mL — hardcoded for now, lifted from profile in future. */
  goalMl: number
  /** 0-100 percent of goal completed, clamped. */
  pctComplete: number
}

export interface UseWaterLogResult {
  data: WaterLogData
  loading: boolean
  add: (ml: number) => Promise<void>
  setTotal: (ml: number) => Promise<void>
  refresh: () => Promise<void>
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEFAULT_GOAL_ML = 2_500

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

function clampPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  const pct = (numerator / denominator) * 100
  if (!Number.isFinite(pct) || pct < 0) return 0
  if (pct > 100) return 100
  return pct
}

function emptyData(goalMl: number): WaterLogData {
  return {
    todayMl: 0,
    goalMl,
    pctComplete: 0,
  }
}

export function useWaterLog(): UseWaterLogResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((state) => state.profile)
  const profileId = profile?.id ?? null

  const [data, setData] = useState<WaterLogData>(() =>
    emptyData(DEFAULT_GOAL_ML),
  )
  const [loading, setLoading] = useState<boolean>(true)

  const fetchWaterLog = useCallback(async (): Promise<void> => {
    if (profileId === null) {
      setData(emptyData(DEFAULT_GOAL_ML))
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const row = await getTodayWaterLog(db, profileId)
      const todayMl = row?.amountMl ?? 0
      setData({
        todayMl,
        goalMl: DEFAULT_GOAL_ML,
        pctComplete: clampPct(todayMl, DEFAULT_GOAL_ML),
      })
    } finally {
      setLoading(false)
    }
  }, [db, profileId])

  // Re-fetch every time the dashboard or water tracker tab gains focus,
  // so a quick-add on the tracker is reflected immediately when the user
  // returns to the food tab or dashboard.
  useFocusEffect(
    useCallback(() => {
      void fetchWaterLog()
    }, [fetchWaterLog]),
  )

  const refresh = useCallback(async (): Promise<void> => {
    await fetchWaterLog()
  }, [fetchWaterLog])

  const add = useCallback(
    async (ml: number): Promise<void> => {
      if (profileId === null) return
      if (!Number.isFinite(ml) || ml <= 0) return
      await addWater(db, profileId, Math.round(ml))
      await fetchWaterLog()
    },
    [db, profileId, fetchWaterLog],
  )

  const setTotal = useCallback(
    async (ml: number): Promise<void> => {
      if (profileId === null) return
      const safe = Number.isFinite(ml) && ml > 0 ? Math.round(ml) : 0
      await setTodayWater(db, profileId, safe)
      await fetchWaterLog()
    },
    [db, profileId, fetchWaterLog],
  )

  return { data, loading, add, setTotal, refresh }
}
