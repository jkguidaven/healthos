/**
 * Macronutrient target calculation for recomposition, bulk, and cut phases.
 *
 * - Recomp:   calories = TDEE,                 protein = 2.2 g/kg, fat = 25% of kcal
 * - Bulk:     calories = TDEE + 250 surplus,   protein = 2.2 g/kg, fat = 25% of kcal
 * - Cut:      calories = TDEE - 350 deficit,   protein = 2.4 g/kg, fat = 25% of kcal
 *
 * Carbs fill the remaining calories. All values rounded to nearest integer.
 *
 * Pure TypeScript — no React, Drizzle, or AI imports.
 */

import {
  BULK_CALORIE_SURPLUS,
  CALORIES_PER_GRAM_CARBS,
  CALORIES_PER_GRAM_FAT,
  CALORIES_PER_GRAM_PROTEIN,
  CUT_CALORIE_DEFICIT,
  CUT_PROTEIN_G_PER_KG,
  FAT_PCT_OF_TDEE,
  RECOMP_PROTEIN_G_PER_KG,
} from './constants'

export interface MacroTargets {
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export type MacroGoal = 'recomposition' | 'bulk' | 'cut'

export function calculateMacroTargets(
  tdee: number,
  weightKg: number,
  goal: MacroGoal,
): MacroTargets {
  // 1. Target calories per goal.
  let calories: number
  switch (goal) {
    case 'recomposition':
      calories = tdee
      break
    case 'bulk':
      calories = tdee + BULK_CALORIE_SURPLUS
      break
    case 'cut':
      calories = tdee - CUT_CALORIE_DEFICIT
      break
  }

  // 2. Protein grams (higher on a cut to preserve lean mass).
  const proteinPerKg =
    goal === 'cut' ? CUT_PROTEIN_G_PER_KG : RECOMP_PROTEIN_G_PER_KG
  const proteinG = weightKg * proteinPerKg

  // 3. Fat grams (fixed percent of target calories).
  const fatG = (calories * FAT_PCT_OF_TDEE) / CALORIES_PER_GRAM_FAT

  // 4. Carbs fill the remainder.
  const proteinCalories = proteinG * CALORIES_PER_GRAM_PROTEIN
  const fatCalories = fatG * CALORIES_PER_GRAM_FAT
  const carbsG =
    (calories - proteinCalories - fatCalories) / CALORIES_PER_GRAM_CARBS

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
  }
}
