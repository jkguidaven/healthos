import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Default Anthropic API handler — returns a valid food scan response
const defaultClaudeHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => {
    return HttpResponse.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name: 'Test food',
            calories: 500,
            protein_g: 40,
            carbs_g: 50,
            fat_g: 15,
            serving_description: '1 serving',
            confidence: 'high',
          }),
        },
      ],
    })
  },
)

export const server = setupServer(defaultClaudeHandler)

// ─── Reusable handler overrides (import these in test files) ───

export const claudeWorkoutPlanHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    HttpResponse.json({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
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
        },
      ],
    }),
)

export const claudeRateLimitHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    new HttpResponse(null, {
      status: 429,
      headers: { 'retry-after': '30' },
    }),
)

export const claudeInvalidKeyHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () => new HttpResponse(null, { status: 401 }),
)

export const claudeMalformedResponseHandler = http.post(
  'https://api.anthropic.com/v1/messages',
  () =>
    HttpResponse.json({
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }],
    }),
)
