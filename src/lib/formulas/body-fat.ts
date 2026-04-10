/**
 * US Navy body fat estimation method.
 * Source: Hodgdon & Beckett (1984), US Navy PRT standards.
 *
 * Inputs in centimetres. Returns a percentage (e.g. 17.2 for 17.2%).
 * Returns null if inputs are physiologically implausible.
 *
 * Pure TypeScript — no React, Drizzle, or AI imports.
 */

import {
  NAVY_MALE_CONST_A,
  NAVY_MALE_CONST_B,
  NAVY_MALE_CONST_C,
  NAVY_MALE_OFFSET,
  NAVY_MALE_DIVISOR,
  NAVY_FEMALE_CONST_A,
  NAVY_FEMALE_CONST_B,
  NAVY_FEMALE_CONST_C,
  NAVY_FEMALE_OFFSET,
  NAVY_FEMALE_DIVISOR,
} from './constants'

export interface BodyFatInput {
  sex: 'male' | 'female'
  heightCm: number
  waistCm: number // measured at navel
  neckCm: number // measured at narrowest point below larynx
  hipCm?: number // required for females, optional for males
}

export interface BodyFatResult {
  bodyFatPct: number
  leanMassKg: number
  fatMassKg: number
  category: BodyFatCategory
}

export type BodyFatCategory =
  | 'essential' // < 6% male, < 14% female
  | 'athletic' // 6–13% male, 14–20% female
  | 'fitness' // 14–20% male, 21–24% female
  | 'average' // 21–24% male, 25–31% female
  | 'obese' // >= 25% male, >= 32% female

export function calculateBodyFat(
  input: BodyFatInput,
  totalWeightKg: number,
): BodyFatResult | null {
  const { sex, heightCm, waistCm, neckCm, hipCm } = input

  // Input validation
  if (heightCm < 100 || heightCm > 250) return null
  if (waistCm < 40 || waistCm > 200) return null
  if (neckCm < 20 || neckCm > 80) return null
  if (sex === 'female' && (!hipCm || hipCm < 40)) return null
  if (waistCm <= neckCm) return null // waist must be larger than neck

  let bodyFatPct: number

  if (sex === 'male') {
    const logDiff = Math.log10(waistCm - neckCm)
    const logHeight = Math.log10(heightCm)
    bodyFatPct =
      NAVY_MALE_DIVISOR /
        (NAVY_MALE_CONST_A -
          NAVY_MALE_CONST_B * logDiff +
          NAVY_MALE_CONST_C * logHeight) -
      NAVY_MALE_OFFSET
  } else {
    const logDiff = Math.log10(waistCm + (hipCm as number) - neckCm)
    const logHeight = Math.log10(heightCm)
    bodyFatPct =
      NAVY_FEMALE_DIVISOR /
        (NAVY_FEMALE_CONST_A -
          NAVY_FEMALE_CONST_B * logDiff +
          NAVY_FEMALE_CONST_C * logHeight) -
      NAVY_FEMALE_OFFSET
  }

  // Clamp to physiologically plausible range
  bodyFatPct = Math.min(Math.max(bodyFatPct, 3), 50)

  const fatMassKg = (bodyFatPct / 100) * totalWeightKg
  const leanMassKg = totalWeightKg - fatMassKg

  return {
    bodyFatPct: Math.round(bodyFatPct * 10) / 10, // one decimal place
    leanMassKg: Math.round(leanMassKg * 10) / 10,
    fatMassKg: Math.round(fatMassKg * 10) / 10,
    category: getBodyFatCategory(sex, bodyFatPct),
  }
}

export function getBodyFatCategory(
  sex: 'male' | 'female',
  pct: number,
): BodyFatCategory {
  if (sex === 'male') {
    if (pct < 6) return 'essential'
    if (pct < 14) return 'athletic'
    if (pct < 21) return 'fitness'
    if (pct < 25) return 'average'
    return 'obese'
  } else {
    if (pct < 14) return 'essential'
    if (pct < 21) return 'athletic'
    if (pct < 25) return 'fitness'
    if (pct < 32) return 'average'
    return 'obese'
  }
}

export const BODY_FAT_CATEGORY_LABEL: Record<BodyFatCategory, string> = {
  essential: 'Essential fat',
  athletic: 'Athletic',
  fitness: 'Fitness',
  average: 'Average',
  obese: 'Above average',
}
