/**
 * src/features/nutrition/use-plate-coach.ts
 *
 * Feature hook powering the Food tab's "Today's plate" coaching card.
 *
 * Pulls together everything the pure formula needs:
 *   - profile (goals + whether onboarding is complete)
 *   - today's macro totals (summed from food_log)
 *   - which meal slots already have ≥ 1 entry today
 *   - deduped list of foods the user has logged in the last 14 days,
 *     with their last-logged macros, for ranking suggestions
 *
 * The formula itself lives in `@/lib/formulas/plate-coach` and is pure
 * TypeScript — this hook is only the data-plumbing layer.
 *
 * Re-runs on every food-log focus: recent-foods list is cached for 60s,
 * but today's totals are driven by the caller's NutritionSummary so the
 * card reflects new entries the instant they're logged.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import {
  getRecentFoodsWithMacros,
  type RecentFoodWithMacros,
} from '@db/queries/food-log'
import {
  computePlateCoach,
  type PlateCoachOutput,
  type PlateCoachRecentFood,
  type MealSlot,
} from '@/lib/formulas/plate-coach'
import { useProfileStore } from '@/stores/profile-store'
import type { NutritionByMeal, NutritionSummary } from './use-food-log'

const RECENT_WINDOW_DAYS = 14
const RECENT_LIMIT = 20

export interface UsePlateCoachArgs {
  /** Today's summed macros from `useFoodLog`. */
  summary: NutritionSummary
  /** Today's entries grouped by meal — used to derive filled slots. */
  byMeal: NutritionByMeal
}

export function usePlateCoach({
  summary,
  byMeal,
}: UsePlateCoachArgs): PlateCoachOutput {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((s) => s.profile)
  const profileId = profile?.id ?? null

  const { data: recentFoodsRaw } = useQuery<RecentFoodWithMacros[]>({
    queryKey: ['plate-coach', 'recent-foods', profileId],
    queryFn: async () => {
      if (profileId === null) return []
      return getRecentFoodsWithMacros(
        db,
        profileId,
        RECENT_WINDOW_DAYS,
        RECENT_LIMIT,
      )
    },
    enabled: profileId !== null,
    staleTime: 60_000,
  })

  const recentFoods = useMemo<PlateCoachRecentFood[]>(() => {
    return (recentFoodsRaw ?? []).map((f) => ({
      name: f.name,
      calories: f.calories,
      proteinG: f.proteinG,
      carbsG: f.carbsG,
      fatG: f.fatG,
    }))
  }, [recentFoodsRaw])

  const loggedSlots = useMemo<ReadonlySet<MealSlot>>(() => {
    const set = new Set<MealSlot>()
    if (byMeal.breakfast.length > 0) set.add('breakfast')
    if (byMeal.lunch.length > 0) set.add('lunch')
    if (byMeal.dinner.length > 0) set.add('dinner')
    if (byMeal.snack.length > 0) set.add('snack')
    return set
  }, [byMeal])

  const mealsLogged =
    byMeal.breakfast.length +
    byMeal.lunch.length +
    byMeal.dinner.length +
    byMeal.snack.length

  return useMemo(
    () =>
      computePlateCoach({
        hour: new Date().getHours(),
        hasProfile: profile !== null,
        goalCalories: profile?.goalCalories ?? 0,
        goalProteinG: profile?.goalProteinG ?? 0,
        todayCalories: summary.calories,
        todayProteinG: summary.proteinG,
        mealsLogged,
        loggedSlots,
        recentFoods,
      }),
    [profile, summary, mealsLogged, loggedSlots, recentFoods],
  )
}
