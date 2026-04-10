/**
 * src/features/nutrition/use-food-log.ts
 *
 * Feature hook for the food log tab.
 *
 * Owns all data access for the nutrition screen:
 *   - reads today's food log entries from SQLite (via Drizzle)
 *   - computes per-meal groupings + today's macro totals
 *   - exposes refresh + deleteEntry handlers
 *
 * Pure data orchestration — no UI concerns, no formatting. The screen
 * is responsible for presentation.
 *
 * If the profile hasn't been created yet we return an empty data shape
 * so the screen can render its zero-state without crashing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import type { FoodLogEntry } from '@db/schema'
import {
  deleteFoodLogEntry as deleteFoodLogEntryQuery,
  getTodayFoodLog,
  getTodayMacroSummary,
} from '@db/queries/food-log'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export interface NutritionByMeal {
  breakfast: FoodLogEntry[]
  lunch: FoodLogEntry[]
  dinner: FoodLogEntry[]
  snack: FoodLogEntry[]
}

export interface NutritionSummary {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface NutritionData {
  entries: FoodLogEntry[]
  byMeal: NutritionByMeal
  summary: NutritionSummary
  goalCalories: number
  goalProteinG: number
}

export interface UseFoodLogResult {
  data: NutritionData
  loading: boolean
  refresh: () => Promise<void>
  deleteEntry: (id: number) => Promise<void>
}

// ─────────────────────────────────────────────
// Empty defaults — used before the first fetch and when no profile exists.
// ─────────────────────────────────────────────

const EMPTY_SUMMARY: NutritionSummary = {
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
}

function emptyByMeal(): NutritionByMeal {
  return { breakfast: [], lunch: [], dinner: [], snack: [] }
}

function emptyData(
  goalCalories: number,
  goalProteinG: number,
): NutritionData {
  return {
    entries: [],
    byMeal: emptyByMeal(),
    summary: { ...EMPTY_SUMMARY },
    goalCalories,
    goalProteinG,
  }
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useFoodLog(): UseFoodLogResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(
    () => drizzle(sqlite, { schema }),
    [sqlite],
  )

  const profile = useProfileStore((state) => state.profile)
  const profileId = profile?.id ?? null
  const goalCalories = profile?.goalCalories ?? 0
  const goalProteinG = profile?.goalProteinG ?? 0

  const [data, setData] = useState<NutritionData>(() =>
    emptyData(goalCalories, goalProteinG),
  )
  const [loading, setLoading] = useState<boolean>(true)

  const fetchFoodLog = useCallback(async (): Promise<void> => {
    if (profileId === null) {
      setData(emptyData(goalCalories, goalProteinG))
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [entries, summary] = await Promise.all([
        getTodayFoodLog(db, profileId),
        getTodayMacroSummary(db, profileId),
      ])

      const byMeal = emptyByMeal()
      for (const entry of entries) {
        byMeal[entry.meal].push(entry)
      }

      setData({
        entries,
        byMeal,
        summary: {
          calories: summary.calories,
          proteinG: summary.proteinG,
          carbsG: summary.carbsG,
          fatG: summary.fatG,
        },
        goalCalories,
        goalProteinG,
      })
    } finally {
      setLoading(false)
    }
  }, [db, profileId, goalCalories, goalProteinG])

  useEffect(() => {
    void fetchFoodLog()
  }, [fetchFoodLog])

  const refresh = useCallback(async (): Promise<void> => {
    await fetchFoodLog()
  }, [fetchFoodLog])

  const deleteEntry = useCallback(
    async (id: number): Promise<void> => {
      await deleteFoodLogEntryQuery(db, id)
      await fetchFoodLog()
    },
    [db, fetchFoodLog],
  )

  return { data, loading, refresh, deleteEntry }
}
