// ═══════════════════════════════════════════════════════════════
// src/features/nutrition/use-food-scanner.ts
// ─────────────────────────────────────────────────────────────
// Layer 3 (feature hook) for the food scanner.
//
// Orchestrates two steps as independent React Query mutations so
// the UI can render the AI result for user editing before it is
// persisted:
//
//   1. scan — base64 image -> Gemini -> validated FoodScanResult
//   2. save — (edited) FoodScanResult + meal + portion -> food_log
//
// This hook owns all side effects. The screens that consume it
// (camera capture, confirm sheet) should be dumb.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import { callAI } from '@ai/ai-client'
import {
  FOOD_SCAN_SYSTEM_PROMPT,
  FoodScanGeminiSchema,
  FoodScanResultSchema,
  buildFoodScanParts,
  type FoodScanResult,
} from '@ai/prompts/food-scan'
import { insertFoodLogEntry } from '@db/queries/food-log'
import * as schema from '@db/schema'
import type { NewFoodLogEntry } from '@db/schema'
import { useProfileStore } from '@/stores/profile-store'

export type ScannedFoodMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface ScanFoodArgs {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  mealContext?: ScannedFoodMeal
}

export interface SaveScannedFoodArgs {
  result: FoodScanResult
  meal: ScannedFoodMeal
  /** Portion multiplier — e.g. 0.5, 1, 1.5, 2. Applied to all macros. */
  portion: number
  /**
   * Which flow produced this result. Maps to the food_log.source enum.
   * Defaults to 'ai_scan' so existing AI callers don't need to change.
   */
  source?: 'ai_scan' | 'barcode'
}

export interface UseFoodScannerReturn {
  // Step 1: scan the image with Gemini
  scan: (args: ScanFoodArgs) => Promise<FoodScanResult>
  isScanning: boolean
  scanError: Error | null

  // Step 2: save the (possibly user-edited) result to SQLite
  save: (args: SaveScannedFoodArgs) => Promise<void>
  isSaving: boolean
  saveError: Error | null
  saveSuccess: boolean

  // Reset both mutations
  reset: () => void
}

/** Today as YYYY-MM-DD (local date, no timezone). */
function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

/** Round to one decimal place — matches how macros are stored elsewhere. */
function roundOneDecimal(n: number): number {
  return Math.round(n * 10) / 10
}

export function useFoodScanner(): UseFoodScannerReturn {
  const sqlite = useSQLiteContext()
  // Memoise so the Drizzle handle is stable across renders — otherwise
  // every render creates a fresh wrapper and React Query sees new deps.
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((s) => s.profile)

  // ─── Step 1: scan ──────────────────────────────────────────
  // Errors from callAI() (APIKeyMissingError, APIKeyInvalidError,
  // AIParseError, AIApiError, AIRateLimitError) are intentionally
  // NOT caught here — we let them propagate so React Query stores
  // them in `scanError` for the UI to narrow on `.code`.
  const scanMutation = useMutation<FoodScanResult, Error, ScanFoodArgs>({
    mutationFn: async ({ imageBase64, mimeType, mealContext }) => {
      return callAI({
        system: FOOD_SCAN_SYSTEM_PROMPT,
        userMessage: buildFoodScanParts({ imageBase64, mimeType, mealContext }),
        schema: FoodScanResultSchema,
        responseSchema: FoodScanGeminiSchema,
        maxTokens: 1024,
      })
    },
  })

  // ─── Step 2: save ──────────────────────────────────────────
  const saveMutation = useMutation<void, Error, SaveScannedFoodArgs>({
    mutationFn: async ({ result, meal, portion, source = 'ai_scan' }) => {
      if (!profile) {
        throw new Error('No profile loaded — cannot save food log entry')
      }

      const entry: NewFoodLogEntry = {
        profileId:   profile.id,
        date:        todayIso(),
        meal,
        name:        result.name,
        calories:    Math.round(result.calories * portion),
        proteinG:    roundOneDecimal(result.protein_g * portion),
        carbsG:      roundOneDecimal(result.carbs_g * portion),
        fatG:        roundOneDecimal(result.fat_g * portion),
        servingDesc: result.serving_description,
        source,
        // Barcode lookups carry no AI confidence — only store it for AI scans.
        confidence:  source === 'ai_scan' ? result.confidence : null,
        aiNotes:     source === 'ai_scan' ? (result.notes ?? null) : null,
      }

      await insertFoodLogEntry(db, entry)
    },
  })

  // ─── Reset both ────────────────────────────────────────────
  const reset = useCallback(() => {
    scanMutation.reset()
    saveMutation.reset()
  }, [scanMutation, saveMutation])

  return {
    scan:         scanMutation.mutateAsync,
    isScanning:   scanMutation.isPending,
    scanError:    scanMutation.error,

    save:         saveMutation.mutateAsync,
    isSaving:     saveMutation.isPending,
    saveError:    saveMutation.error,
    saveSuccess:  saveMutation.isSuccess,

    reset,
  }
}
