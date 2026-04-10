/**
 * Body Mass Index (BMI) — the simple weight-for-height ratio used as
 * a coarse health screen. Defined as `weight (kg) / height (m)^2`.
 *
 * Pure TypeScript — no React, Drizzle, or AI imports.
 *
 * Caveats (the screen should communicate these, not the formula):
 *   - BMI does not distinguish lean mass from fat mass. A muscular
 *     lifter with 12% body fat can register as "overweight" or even
 *     "obese" because the scale doesn't know muscle from fat. For
 *     recomp-focused users, body fat % is a far better signal.
 *   - BMI was designed for population-level statistics, not for any
 *     single individual.
 *   - Below 13.5 or above 60 is physiologically implausible — return
 *     null for those inputs so the UI can render an empty state.
 */

const MIN_HEIGHT_CM = 100
const MAX_HEIGHT_CM = 250
const MIN_WEIGHT_KG = 30
const MAX_WEIGHT_KG = 300
const MIN_PLAUSIBLE_BMI = 13.5
const MAX_PLAUSIBLE_BMI = 60

export type BMICategory =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese_class_1'
  | 'obese_class_2'
  | 'obese_class_3'

export interface BMIResult {
  bmi: number // rounded to 1 decimal
  category: BMICategory
}

/**
 * Compute BMI from height (cm) and weight (kg).
 * Returns null if either input is missing or physiologically implausible.
 */
export function calculateBMI(
  heightCm: number,
  weightKg: number,
): BMIResult | null {
  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg)) return null
  if (heightCm < MIN_HEIGHT_CM || heightCm > MAX_HEIGHT_CM) return null
  if (weightKg < MIN_WEIGHT_KG || weightKg > MAX_WEIGHT_KG) return null

  const heightM = heightCm / 100
  const raw = weightKg / (heightM * heightM)

  if (raw < MIN_PLAUSIBLE_BMI || raw > MAX_PLAUSIBLE_BMI) return null

  return {
    bmi: Math.round(raw * 10) / 10,
    category: getBMICategory(raw),
  }
}

/**
 * WHO BMI categories. Same thresholds for both sexes.
 *  - underweight:    < 18.5
 *  - normal:         18.5 – 24.9
 *  - overweight:     25.0 – 29.9
 *  - obese class 1:  30.0 – 34.9
 *  - obese class 2:  35.0 – 39.9
 *  - obese class 3:  ≥ 40.0
 */
export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return 'underweight'
  if (bmi < 25) return 'normal'
  if (bmi < 30) return 'overweight'
  if (bmi < 35) return 'obese_class_1'
  if (bmi < 40) return 'obese_class_2'
  return 'obese_class_3'
}

export const BMI_CATEGORY_LABEL: Record<BMICategory, string> = {
  underweight: 'Underweight',
  normal: 'Healthy weight',
  overweight: 'Overweight',
  obese_class_1: 'Obese (class I)',
  obese_class_2: 'Obese (class II)',
  obese_class_3: 'Obese (class III)',
}
