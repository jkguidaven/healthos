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
import type { ContentBlock } from '../ai-client'

export const FOOD_SCAN_SYSTEM_PROMPT = `You are a nutrition analysis assistant. Your job is to identify food in photos and estimate macronutrient content.

RULES:
- Estimate for a single standard serving unless the image clearly shows multiple portions.
- If you see multiple distinct food items, identify the primary/largest item.
- Base estimates on standard nutritional databases (USDA). Round to nearest whole number.
- confidence: "high" = clearly identifiable food with well-known nutrition profile. "medium" = identifiable but portion is ambiguous or it's a mixed dish. "low" = unrecognisable, heavily processed, or obstructed.
- If you genuinely cannot identify the food at all, set name to "Unknown food" and confidence to "low" with all macros at 0.
- Never refuse to respond. Always return the structured result, even for uncertain cases.`

export interface FoodScanInput {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  mealContext?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
}

export function buildFoodScanParts(input: FoodScanInput): ContentBlock[] {
  return [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.mimeType,
        data: input.imageBase64,
      },
    },
    {
      type: 'text',
      text: input.mealContext
        ? `Identify this food and estimate its macros. This is a ${input.mealContext} item.`
        : 'Identify this food and estimate its macros.',
    },
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
