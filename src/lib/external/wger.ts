/**
 * src/lib/external/wger.ts
 *
 * Typed client for the WGER exercise database public REST API.
 *
 *   https://wger.de/api/v2/exercise/search/?language=en&term={term}
 *   https://wger.de/api/v2/exerciseinfo/{id}/
 *
 * WGER is a free, open-source, no-auth exercise database. We use it to
 * enrich AI-generated workout plan exercises with visual references
 * (thumbnail + full image) and metadata (category) that the plan view
 * and session logger render next to each exercise.
 *
 * Design notes:
 *  - This module is platform-agnostic HTTPS only (no Expo APIs), so it
 *    runs on iOS, Android, and web.
 *  - We parse the response with Zod to stay honest about the shape.
 *    The WGER search endpoint is fairly stable but `image` can be null,
 *    `base_id` is optional on older entries, etc.
 *  - Two typed error classes let callers narrow on `instanceof` or
 *    `.code` and render the right recovery UI. `findBestExercise`
 *    swallows NotFound and returns null so the caller can fall back
 *    to a generic "no thumbnail" placeholder without try/catch.
 *  - Image URLs from WGER are site-relative (e.g. "/media/..."). We
 *    resolve them to absolute URLs here so consumers can pass them
 *    straight to `<Image source={{ uri }}` without thinking.
 */

import { z } from 'zod'

const WGER_BASE = 'https://wger.de'
const WGER_API = `${WGER_BASE}/api/v2`

// ─────────────────────────────────────────────
// Response schemas
// ─────────────────────────────────────────────

const SearchSuggestionDataSchema = z.object({
  id: z.number(),
  base_id: z.number().optional(),
  name: z.string(),
  category: z.string().optional(),
  image: z.string().nullable().optional(),
  image_thumbnail: z.string().nullable().optional(),
})

const SearchSuggestionSchema = z.object({
  value: z.string(),
  data: SearchSuggestionDataSchema,
})

const SearchResponseSchema = z.object({
  suggestions: z.array(SearchSuggestionSchema),
})

// ─────────────────────────────────────────────
// Public output shape
// ─────────────────────────────────────────────

/**
 * Normalised exercise data, ready to render in the workout plan view
 * and session logger. Image URLs are absolute (or null) so consumers
 * can drop them into `<Image source={{ uri }}` directly.
 */
export interface WgerExercise {
  id: number
  name: string
  category: string | null
  /** Absolute URL to the full-size exercise image, or null. */
  imageUrl: string | null
  /** Absolute URL to the thumbnail version, or null. */
  thumbnailUrl: string | null
}

// ─────────────────────────────────────────────
// Typed errors
// ─────────────────────────────────────────────

/**
 * The search term didn't match any WGER exercises. Surface to callers
 * who specifically asked for a lookup — `findBestExercise` catches this
 * and returns null instead, since missing thumbnails aren't user-facing
 * errors.
 */
export class WgerNotFoundError extends Error {
  readonly code = 'wger_not_found' as const
  constructor(public readonly term: string) {
    super(`No WGER exercise matches "${term}"`)
    this.name = 'WgerNotFoundError'
  }
}

/**
 * The WGER request failed at the transport layer (offline, DNS error,
 * 5xx, malformed JSON, schema mismatch). Surface to the user as a
 * "couldn't load exercise images — check your connection" message.
 */
export class WgerNetworkError extends Error {
  readonly code = 'wger_network_error' as const
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WgerNetworkError'
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * WGER returns image paths relative to its site root (e.g.
 * "/media/exercise-images/192/Bench-press-1.png"). Prepend the host to
 * make them consumable by React Native's `<Image>`. Pass-through for
 * already-absolute URLs so we don't double-prefix if WGER ever starts
 * returning them.
 */
function buildAbsoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${WGER_BASE}${path}`
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Search WGER for exercises by name. Returns the top matches as
 * normalised `WgerExercise` objects with absolute image URLs.
 *
 * @param term  exercise name (e.g. "barbell bench press")
 * @param limit maximum number of suggestions to return (default 5)
 *
 * @throws {WgerNotFoundError} if the search returns no suggestions.
 * @throws {WgerNetworkError}  on any transport / parse failure.
 */
export async function searchExercises(
  term: string,
  limit = 5,
): Promise<WgerExercise[]> {
  const url = `${WGER_API}/exercise/search/?language=en&term=${encodeURIComponent(
    term,
  )}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
  } catch (error) {
    throw new WgerNetworkError(
      'Failed to reach WGER — check your connection and try again.',
      error,
    )
  }

  if (!response.ok) {
    throw new WgerNetworkError(
      `WGER request failed with HTTP ${response.status}`,
    )
  }

  let json: unknown
  try {
    json = await response.json()
  } catch (error) {
    throw new WgerNetworkError(
      'WGER returned an unreadable response.',
      error,
    )
  }

  const parsed = SearchResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new WgerNetworkError(
      'WGER returned an unexpected response shape.',
      parsed.error,
    )
  }

  if (parsed.data.suggestions.length === 0) {
    throw new WgerNotFoundError(term)
  }

  return parsed.data.suggestions.slice(0, limit).map((suggestion) => ({
    id: suggestion.data.id,
    name: suggestion.data.name,
    category: suggestion.data.category ?? null,
    imageUrl: buildAbsoluteUrl(suggestion.data.image),
    thumbnailUrl: buildAbsoluteUrl(suggestion.data.image_thumbnail),
  }))
}

/**
 * Find the single best WGER match for an exercise name. Returns `null`
 * (not throws) when no result is found — most exercise names from the
 * AI plan generator will be searchable but not all, and the UI should
 * fall back gracefully to "no thumbnail available".
 *
 * Network errors are still thrown so the caller can decide whether to
 * surface them (e.g. retry on reconnect).
 *
 * @throws {WgerNetworkError} on any transport / parse failure.
 */
export async function findBestExercise(
  term: string,
): Promise<WgerExercise | null> {
  try {
    const results = await searchExercises(term, 1)
    return results[0] ?? null
  } catch (error) {
    if (error instanceof WgerNotFoundError) return null
    throw error
  }
}
