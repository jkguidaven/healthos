/**
 * src/stores/scan-store.ts
 *
 * Ephemeral handoff state between the food scan camera screen and the
 * confirm screen. The data here is short-lived — it exists only for the
 * few seconds between capture → confirm → save, and is cleared as soon
 * as the user either logs the meal or bails out.
 *
 * Why a store instead of navigation params? The base64 image is too big
 * for URL params (expo-router serialises everything through strings), and
 * the scan result is a structured object we'd rather not JSON.stringify
 * through the URL. Keeping it in a Zustand slice is simpler, cleaner, and
 * avoids any serialisation cost.
 *
 * The `source` field tells the confirm screen where the result came from
 * so it can render the appropriate badge ("AI scan" vs "Barcode scan")
 * and so the save mutation can persist the correct food_log source value.
 */

import { create } from 'zustand'

import type { FoodScanResult } from '@ai/prompts/food-scan'

/**
 * Where the pending scan result came from.
 *  - 'ai'      — Gemini vision analysis of a food photo
 *  - 'barcode' — Open Food Facts lookup from a scanned barcode
 */
export type ScanSource = 'ai' | 'barcode'

export interface ScanStoreState {
  /** The validated scan result, or null if no scan is pending review. */
  result: FoodScanResult | null
  /**
   * Optional raw base64 payload of the captured photo, used purely as a
   * preview thumbnail on the confirm screen. Null for barcode scans,
   * which don't capture a photo.
   */
  imageBase64: string | null
  /** Mime type for the captured image — used when rendering the preview. */
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null
  /**
   * Where this result came from. Defaults to 'ai' so existing callers
   * that don't pass a source keep their current behaviour.
   */
  source: ScanSource
  setScan: (
    result: FoodScanResult,
    imageBase64?: string | null,
    imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | null,
    source?: ScanSource,
  ) => void
  clear: () => void
}

export const useScanStore = create<ScanStoreState>((set) => ({
  result: null,
  imageBase64: null,
  imageMimeType: null,
  source: 'ai',
  setScan: (result, imageBase64 = null, imageMimeType = null, source = 'ai') =>
    set({ result, imageBase64, imageMimeType, source }),
  clear: () =>
    set({
      result: null,
      imageBase64: null,
      imageMimeType: null,
      source: 'ai',
    }),
}))
