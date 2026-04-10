import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// MSW handlers for the Gemini Generative Language API.
// callAI() targets `:generateContent` so handlers match by URL prefix.
const GEMINI_URL = /https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/.*/

function geminiResponse(text: string) {
  return HttpResponse.json({
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text }],
        },
      },
    ],
  })
}

// Default handler — returns a valid food scan response
const defaultGeminiHandler = http.post(GEMINI_URL, () =>
  geminiResponse(
    JSON.stringify({
      name: 'Test food',
      calories: 500,
      protein_g: 40,
      carbs_g: 50,
      fat_g: 15,
      serving_description: '1 serving',
      confidence: 'high',
    }),
  ),
)

export const server = setupServer(defaultGeminiHandler)

// ─── Reusable handler overrides (import these in test files) ───

export const geminiWorkoutPlanHandler = http.post(GEMINI_URL, () =>
  geminiResponse(
    JSON.stringify({
      plan_name: 'Test PPL plan',
      plan_rationale: 'A test plan for unit testing.',
      split_type: 'ppl',
      weeks_total: 8,
      days_per_week: 4,
      days: [
        {
          day_name: 'Push A',
          muscle_groups: ['chest', 'shoulders', 'triceps'],
          estimated_duration_minutes: 60,
          exercises: [
            {
              name: 'Barbell bench press',
              sets: 4,
              reps: 8,
              rest_seconds: 120,
              weight_kg: null,
              progression_note: 'Add 2.5kg when all sets complete.',
            },
          ],
        },
      ],
    }),
  ),
)

export const geminiRateLimitHandler = http.post(
  GEMINI_URL,
  () =>
    new HttpResponse(null, {
      status: 429,
      headers: { 'retry-after': '30' },
    }),
)

export const geminiInvalidKeyHandler = http.post(
  GEMINI_URL,
  () =>
    new HttpResponse(JSON.stringify({ error: { message: 'API_KEY_INVALID' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    }),
)

export const geminiMalformedResponseHandler = http.post(GEMINI_URL, () =>
  geminiResponse('Sorry, I cannot help with that.'),
)
