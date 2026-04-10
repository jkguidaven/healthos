/**
 * src/features/nutrition/use-barcode-scanner.ts
 *
 * Layer 3 — Feature hook for the barcode scanner.
 *
 * Given a raw barcode string (EAN / UPC) from the camera, look the product
 * up against Open Food Facts and map the result into the same FoodScanResult
 * shape the AI scanner produces. That lets the barcode flow reuse the
 * existing food-scan confirm screen without any special casing.
 *
 * Design notes:
 *  - No React Query here. The lookup is a single-shot, non-retrying call
 *    triggered by a camera event — plain `useState` is simpler and gives
 *    the screen direct control over the "first detection wins" guard.
 *  - Errors are stored in a union type so the camera screen can narrow
 *    on `.code` and render the right recovery banner.
 *  - We set confidence to "high" — barcode data comes from a verified
 *    product database, it isn't an AI guess.
 */

import { useCallback, useRef, useState } from 'react'

import type { FoodScanResult } from '@ai/prompts/food-scan'
import {
  BarcodeNetworkError,
  BarcodeNotFoundError,
  lookupBarcode,
  type BarcodeProduct,
} from '@/lib/external/open-food-facts'

export type BarcodeScanError = BarcodeNotFoundError | BarcodeNetworkError

export interface UseBarcodeScannerReturn {
  /**
   * Look up a barcode and return a FoodScanResult ready to drop into the
   * scan store. Rethrows a typed error on failure (callers can also read
   * the same error off `scanError`).
   */
  scan: (barcode: string) => Promise<FoodScanResult>
  isScanning: boolean
  scanError: BarcodeScanError | null
  /** Clear the error + scanning state (used when the user retries). */
  reset: () => void
}

/**
 * Map an OFF product into the FoodScanResult shape the confirm screen
 * expects. Name includes the brand when available for at-a-glance
 * identification ("Nutella · Ferrero" style).
 */
function productToScanResult(product: BarcodeProduct): FoodScanResult {
  const displayName = product.brand
    ? `${product.name} · ${product.brand}`
    : product.name

  return {
    // Clamp to the 100-char limit in FoodScanResultSchema — defensive, OFF
    // product names are usually short but concatenating with the brand can
    // push it over on rare products.
    name: displayName.slice(0, 100),
    calories: product.calories,
    protein_g: product.proteinG,
    carbs_g: product.carbsG,
    fat_g: product.fatG,
    serving_description: product.servingDescription.slice(0, 100),
    confidence: 'high',
    notes: 'Looked up from Open Food Facts',
  }
}

export function useBarcodeScanner(): UseBarcodeScannerReturn {
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanError, setScanError] = useState<BarcodeScanError | null>(null)

  // Track in-flight barcode so rapid duplicate callbacks from the camera
  // (which fires onBarcodeScanned repeatedly while a code is in frame)
  // don't re-enter the mutation. The screen also holds its own "already
  // handled" guard, but belt-and-braces here keeps the hook safe if it's
  // ever used from a different entry point.
  const inFlightRef = useRef<string | null>(null)

  const scan = useCallback(
    async (barcode: string): Promise<FoodScanResult> => {
      if (inFlightRef.current === barcode) {
        // Same barcode is already being looked up — return a never-
        // resolving promise would be wrong, so throw a synthetic error.
        // Screens should use the outer guard to avoid reaching this path.
        throw new BarcodeNetworkError('Lookup already in progress')
      }

      inFlightRef.current = barcode
      setIsScanning(true)
      setScanError(null)

      try {
        const product = await lookupBarcode(barcode)
        return productToScanResult(product)
      } catch (error) {
        if (
          error instanceof BarcodeNotFoundError ||
          error instanceof BarcodeNetworkError
        ) {
          setScanError(error)
          throw error
        }
        // Anything else (should never happen — lookupBarcode only throws
        // typed errors) gets wrapped as a network error so the UI has a
        // single narrow path.
        const wrapped = new BarcodeNetworkError(
          'Unexpected error while looking up barcode',
          error,
        )
        setScanError(wrapped)
        throw wrapped
      } finally {
        setIsScanning(false)
        inFlightRef.current = null
      }
    },
    [],
  )

  const reset = useCallback((): void => {
    setScanError(null)
    setIsScanning(false)
    inFlightRef.current = null
  }, [])

  return { scan, isScanning, scanError, reset }
}
