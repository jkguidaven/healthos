/**
 * src/lib/external/open-food-facts.ts
 *
 * Typed client for the Open Food Facts public product API.
 *
 *   https://world.openfoodfacts.org/api/v2/product/{barcode}.json
 *
 * Open Food Facts is a free, no-auth, public nutrition database. We use it
 * to back the in-app barcode scanner — the user points the camera at a
 * product barcode, we look it up here, and map the response into the same
 * shape as our AI food-scan flow so it can reuse the confirm screen.
 *
 * Design notes:
 *  - This module is platform-agnostic HTTP only (no Expo APIs), so it runs
 *    on iOS, Android, and web.
 *  - We parse the response with Zod to stay honest about the shape —
 *    nutriments in particular are a "best effort" grab-bag from the OFF
 *    database and many fields may be missing.
 *  - We intentionally model two typed error classes so callers can narrow
 *    on `instanceof` (or `.code`) and render the right recovery UI.
 *  - Macros are rounded here (integers for kcal, 1 decimal for grams) to
 *    match how the food_log table stores them — avoids surprise rounding
 *    on the confirm screen.
 */

import { z } from 'zod'

// ─────────────────────────────────────────────
// Response schemas
// ─────────────────────────────────────────────

/**
 * Nutriments sub-object. OFF returns a lot of optional numeric fields; we
 * only care about energy + macros and we accept either per-serving or per
 * -100g values (we fall back between them).
 *
 * `passthrough()` keeps any extra numeric fields on the parsed object
 * without failing validation — OFF occasionally adds new keys.
 */
const NutrimentsSchema = z
  .object({
    'energy-kcal_serving': z.number().optional(),
    'energy-kcal_100g': z.number().optional(),
    proteins_serving: z.number().optional(),
    proteins_100g: z.number().optional(),
    carbohydrates_serving: z.number().optional(),
    carbohydrates_100g: z.number().optional(),
    fat_serving: z.number().optional(),
    fat_100g: z.number().optional(),
  })
  .passthrough()

const ProductSchema = z.object({
  product_name: z.string().optional(),
  product_name_en: z.string().optional(),
  brands: z.string().optional(),
  nutriments: NutrimentsSchema.optional(),
  serving_size: z.string().optional(),
  code: z.string().optional(),
})

const OffResponseSchema = z.object({
  // 1 = product found, 0 = not found
  status: z.number(),
  status_verbose: z.string().optional(),
  product: ProductSchema.optional(),
})

// ─────────────────────────────────────────────
// Public output shape
// ─────────────────────────────────────────────

/**
 * Normalised product data, ready to flow into the food-scan confirm screen.
 * Values are already rounded to the precision the food_log table expects.
 */
export interface BarcodeProduct {
  name: string
  brand: string | null
  servingDescription: string
  /** kcal per serving (falls back to per-100g, then 0). */
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

// ─────────────────────────────────────────────
// Typed errors
// ─────────────────────────────────────────────

/**
 * The barcode parsed from the camera is well-formed but isn't present in
 * the Open Food Facts database. Surface to the user as a friendly
 * "we don't know this product — try the camera scan instead" message.
 */
export class BarcodeNotFoundError extends Error {
  readonly code = 'not_found' as const
  constructor(public readonly barcode: string) {
    super(`Barcode ${barcode} not found in Open Food Facts`)
    this.name = 'BarcodeNotFoundError'
  }
}

/**
 * The OFF request failed at the transport layer (offline, DNS error,
 * 5xx, malformed JSON, schema mismatch). Surface to the user as a
 * "check your connection and try again" message.
 */
export class BarcodeNetworkError extends Error {
  readonly code = 'network_error' as const
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'BarcodeNetworkError'
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Round to nearest integer (kcal). */
function roundInt(n: number): number {
  return Math.round(n)
}

/** Round to 1 decimal place (grams). */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * Pick the per-serving value if present, otherwise fall back to the
 * per-100g value, otherwise 0. OFF data is inconsistent — some products
 * only have serving data, others only have 100g, plenty have both.
 */
function pickNutrient(
  servingValue: number | undefined,
  per100gValue: number | undefined,
): number {
  if (typeof servingValue === 'number' && !Number.isNaN(servingValue)) {
    return servingValue
  }
  if (typeof per100gValue === 'number' && !Number.isNaN(per100gValue)) {
    return per100gValue
  }
  return 0
}

/**
 * OFF `brands` is a comma-separated string (e.g. "Ferrero,Nutella"). Take
 * the first entry and trim. Returns null if nothing usable.
 */
function firstBrand(brands: string | undefined): string | null {
  if (!brands) return null
  const first = brands.split(',')[0]?.trim()
  return first && first.length > 0 ? first : null
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'

/**
 * Look up a barcode against the Open Food Facts public API.
 *
 * @throws {BarcodeNotFoundError} if the barcode isn't in the OFF database.
 * @throws {BarcodeNetworkError} on any transport / parse failure.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeProduct> {
  const url = `${OFF_BASE_URL}/${encodeURIComponent(barcode)}.json`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
  } catch (error) {
    throw new BarcodeNetworkError(
      'Failed to reach Open Food Facts — check your connection and try again.',
      error,
    )
  }

  if (!response.ok) {
    // OFF returns 200 even for missing products (status=0 in the body), so
    // any non-2xx is a genuine transport error worth surfacing.
    throw new BarcodeNetworkError(
      `Open Food Facts request failed with HTTP ${response.status}`,
    )
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (error) {
    throw new BarcodeNetworkError(
      'Open Food Facts returned an unreadable response.',
      error,
    )
  }

  const parsed = OffResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new BarcodeNetworkError(
      'Open Food Facts returned an unexpected response shape.',
      parsed.error,
    )
  }

  const body = parsed.data
  if (body.status !== 1 || !body.product) {
    throw new BarcodeNotFoundError(barcode)
  }

  const product = body.product
  const nutriments = product.nutriments ?? {}

  const name =
    product.product_name_en?.trim() ||
    product.product_name?.trim() ||
    'Unknown product'

  const servingDescription =
    product.serving_size?.trim() && product.serving_size.trim().length > 0
      ? product.serving_size.trim()
      : '100 g'

  const calories = roundInt(
    pickNutrient(
      nutriments['energy-kcal_serving'],
      nutriments['energy-kcal_100g'],
    ),
  )
  const proteinG = round1(
    pickNutrient(nutriments.proteins_serving, nutriments.proteins_100g),
  )
  const carbsG = round1(
    pickNutrient(
      nutriments.carbohydrates_serving,
      nutriments.carbohydrates_100g,
    ),
  )
  const fatG = round1(
    pickNutrient(nutriments.fat_serving, nutriments.fat_100g),
  )

  return {
    name,
    brand: firstBrand(product.brands),
    servingDescription,
    calories,
    proteinG,
    carbsG,
    fatG,
  }
}
