// ═══════════════════════════════════════════════════════════════
// src/lib/ai/prompts/food-scan.ts
// ─────────────────────────────────────────────────────────────
// Food photo scan prompt. Given a base64-encoded food image,
// Gemini identifies the food and estimates macronutrients per
// standard serving.
//
// Authoritative spec: ai-prompts.md § 1.
// Do not paraphrase the system prompt or relax the Zod bounds
// without updating the spec first.
// ═══════════════════════════════════════════════════════════════

import { z } from 'zod'
import type { ContentBlock, GeminiResponseSchema } from '../ai-client'

export const FOOD_SCAN_SYSTEM_PROMPT = `You are a nutrition analysis assistant. Your job is to identify food in photos and estimate macronutrient content.

RULES:
- Estimate for a single standard serving unless the image clearly shows multiple portions.
- If you see multiple distinct food items, identify the primary/largest item.
- Base estimates on standard nutritional databases (USDA). Round to nearest whole number.
- confidence: "high" = clearly identifiable food with well-known nutrition profile. "medium" = identifiable but portion is ambiguous or it's a mixed dish. "low" = unrecognisable, heavily processed, or obstructed.
- If you genuinely cannot identify the food at all, set name to "Unknown food" and confidence to "low" with all macros at 0.
- Never refuse to respond. Always return the structured result, even for uncertain cases.

RECENT FOODS ANCHOR:
- The user message may include a "Recent foods" list — dishes this user has logged in the past two weeks, most-frequent first. Users tend to eat the same meals repeatedly.
- If your confidence from the image alone is HIGH, ignore the list and identify normally.
- If your confidence would otherwise be MEDIUM or LOW, check whether the plate visually matches any recent food. If it does, use that food's name and (when sensible) its serving_description style, and bump confidence up one level.
- NEVER copy macros from any recent food. Always recompute calories, protein_g, carbs_g and fat_g from the visible portion — the user's portion on this plate may differ from past meals.
- Only anchor to a recent food when visual features are genuinely consistent. Do not force a match; a wrong anchor is worse than an honest "Unknown food".

The response schema is enforced. You MUST use these exact field names: name, calories, protein_g, carbs_g, fat_g, serving_description, confidence, notes.`

export interface RecentFoodAnchor {
  name: string
  servingDescription: string | null
}

export interface FoodScanInput {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  mealContext?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  /**
   * Optional free-text hint from the user to disambiguate the dish, its
   * ingredients, or the portion size. Trust the hint over visual guesses
   * when they conflict — the user is looking at the real plate.
   */
  userContext?: string
  /**
   * Optional list of dishes the user has logged recently. Used as an
   * identification anchor only when the model's confidence would otherwise
   * be medium/low. Macros must still be recomputed from the visible portion.
   */
  recentFoods?: readonly RecentFoodAnchor[]
}

export function buildFoodScanParts(input: FoodScanInput): ContentBlock[] {
  const base = input.mealContext
    ? `Identify this food and estimate its macros. This is a ${input.mealContext} item.`
    : 'Identify this food and estimate its macros.'

  const hint = input.userContext?.trim()
  const sections: string[] = [base]

  if (hint) {
    sections.push(
      `The user provided this additional context — trust it over visual guesses when they conflict, and recompute the macros accordingly: "${hint}"`,
    )
  }

  const recent = (input.recentFoods ?? []).filter((f) => f.name.trim() !== '')
  if (recent.length > 0) {
    const lines = recent.map((f, i) => {
      const serving = f.servingDescription?.trim()
      return serving
        ? `${i + 1}. ${f.name} (usually ${serving})`
        : `${i + 1}. ${f.name}`
    })
    sections.push(
      `Recent foods this user has logged in the last 14 days (most frequent first). Use only if you are not highly confident from the image alone — and recompute macros from the visible portion, do NOT copy serving macros:\n${lines.join('\n')}`,
    )
  }

  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.mimeType,
        data: input.imageBase64,
      },
    },
    { type: 'text', text: sections.join('\n\n') },
  ]
}

export const FoodScanResultSchema = z.object({
  name: z.string().min(1).max(100),
  calories: z.number().int().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(500),
  serving_description: z.string().max(100),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().max(300).optional(),
})

export type FoodScanResult = z.infer<typeof FoodScanResultSchema>

/**
 * Gemini-flavored response schema. Passing this in `generationConfig.responseSchema`
 * forces Gemini to produce exactly these field names (no guessing). The Zod schema
 * above is still used for runtime validation as a defensive second layer.
 */
export const FoodScanGeminiSchema: GeminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Name of the primary food item' },
    calories: {
      type: 'INTEGER',
      description: 'Calories per single standard serving (kcal)',
    },
    protein_g: {
      type: 'NUMBER',
      description: 'Protein in grams per single standard serving',
    },
    carbs_g: {
      type: 'NUMBER',
      description: 'Carbohydrates in grams per single standard serving',
    },
    fat_g: {
      type: 'NUMBER',
      description: 'Fat in grams per single standard serving',
    },
    serving_description: {
      type: 'STRING',
      description: 'Human-readable serving size, e.g. "1 bowl (~400g)"',
    },
    confidence: {
      type: 'STRING',
      enum: ['high', 'medium', 'low'],
      description: 'How confident the model is in the identification',
    },
    notes: {
      type: 'STRING',
      description: 'Optional caveats or assumptions made during the estimate',
    },
  },
  required: [
    'name',
    'calories',
    'protein_g',
    'carbs_g',
    'fat_g',
    'serving_description',
    'confidence',
  ],
}
