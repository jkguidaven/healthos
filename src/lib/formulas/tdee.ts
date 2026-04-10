/**
 * BMR (Basal Metabolic Rate) and TDEE (Total Daily Energy Expenditure).
 *
 * Uses the Mifflin-St Jeor equation (1990), which is more accurate than
 * the older Harris-Benedict for modern populations.
 *
 * Pure TypeScript — no React, Drizzle, or AI imports.
 */

import { ACTIVITY_MULTIPLIERS } from './constants'

export interface BMRInput {
  sex: 'male' | 'female'
  weightKg: number
  heightCm: number
  age: number
}

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active'

/**
 * Mifflin-St Jeor BMR.
 *
 *   Male:   10*kg + 6.25*cm - 5*age + 5
 *   Female: 10*kg + 6.25*cm - 5*age - 161
 *
 * Returns kilocalories per day, rounded to the nearest integer.
 */
export function calculateBMR(input: BMRInput): number {
  const { sex, weightKg, heightCm, age } = input
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const bmr = sex === 'male' ? base + 5 : base - 161
  return Math.round(bmr)
}

/**
 * Total Daily Energy Expenditure.
 *
 * Multiplies BMR by an activity multiplier. Returns kilocalories
 * per day, rounded to the nearest integer.
 */
export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activity]
  return Math.round(bmr * multiplier)
}
