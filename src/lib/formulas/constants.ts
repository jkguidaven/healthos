/**
 * Shared constants for HealthOS health formulas.
 *
 * Every magic number used in `src/lib/formulas/` lives here with a source
 * citation. Pure TypeScript — no React, no Drizzle, no AI imports.
 */

// ─── Macronutrient energy content ──────────────────────────────
// Atwater general factors. Source: USDA, "Energy Value of Foods" (1973).

/** Kilocalories per gram of protein. */
export const CALORIES_PER_GRAM_PROTEIN = 4

/** Kilocalories per gram of carbohydrate. */
export const CALORIES_PER_GRAM_CARBS = 4

/** Kilocalories per gram of fat. */
export const CALORIES_PER_GRAM_FAT = 9

// ─── TDEE activity multipliers ─────────────────────────────────
// Source: Mifflin, M.D. et al. "A new predictive equation for resting
// energy expenditure in healthy individuals." Am J Clin Nutr 51 (1990).
// Activity multipliers are the commonly-cited Harris–Benedict derived
// values used alongside Mifflin-St Jeor BMR.

/** Activity level multipliers applied to BMR to produce TDEE. */
export const ACTIVITY_MULTIPLIERS = {
  /** Little or no exercise, desk job. */
  sedentary: 1.2,
  /** Light exercise 1–3 days/week. */
  light: 1.375,
  /** Moderate exercise 3–5 days/week. */
  moderate: 1.55,
  /** Hard exercise 6–7 days/week. */
  active: 1.725,
  /** Very hard exercise, physical job, or 2x/day training. */
  very_active: 1.9,
} as const

// ─── Recomp / bulk / cut macro targets ─────────────────────────
// Protein target derived from Helms et al. "Evidence-based recommendations
// for natural bodybuilding contest preparation" (JISSN 2014), and Phillips
// & Van Loon "Dietary protein for athletes" (J Sports Sci 2011).
// Fat-percent-of-TDEE floor from Lambert et al. "Macronutrient
// considerations for the sport of bodybuilding" (Sports Med 2004).

/** Grams of protein per kilogram of bodyweight for recomposition and bulk. */
export const RECOMP_PROTEIN_G_PER_KG = 2.2

/** Grams of protein per kilogram of bodyweight during a cut (higher to preserve lean mass). */
export const CUT_PROTEIN_G_PER_KG = 2.4

/** Fraction of TDEE that comes from fat (minimum healthy fat intake). */
export const FAT_PCT_OF_TDEE = 0.25

/** Calorie surplus above TDEE for a bulk phase. */
export const BULK_CALORIE_SURPLUS = 250

/** Calorie deficit below TDEE for a cut phase. */
export const CUT_CALORIE_DEFICIT = 350

// ─── US Navy body fat formula constants ────────────────────────
// Source: Hodgdon, J.A. & Beckett, M.B. "Prediction of percent body fat
// for US Navy men and women from body circumferences and height."
// Naval Health Research Center Report No. 84-11 (1984).

export const NAVY_MALE_CONST_A = 1.0324
export const NAVY_MALE_CONST_B = 0.19077
export const NAVY_MALE_CONST_C = 0.15456
export const NAVY_MALE_OFFSET = 450
export const NAVY_MALE_DIVISOR = 495

export const NAVY_FEMALE_CONST_A = 1.29579
export const NAVY_FEMALE_CONST_B = 0.35004
export const NAVY_FEMALE_CONST_C = 0.22100
export const NAVY_FEMALE_OFFSET = 450
export const NAVY_FEMALE_DIVISOR = 495
