# ADR 003 — Gemini as the AI provider

**Status:** Accepted (revised 2026-04-10)

## Decision

Use Google's Gemini API (`gemini-2.5-flash`) for food scanning, workout plan generation, and coaching. Each user provides their own API key from Google AI Studio's free tier — no credit card required.

## History

The original choice (March 2026) was Anthropic's Claude API (`claude-sonnet-4-6`). It was chosen for vision quality, reasoning, and a single, clean REST API. We switched to Gemini on **2026-04-10** because Anthropic's prepaid credit-balance model created onboarding friction that was incompatible with HealthOS's local-first, personal-use philosophy: a new user had to create an Anthropic account, add a payment method, top up credits, and remember to do it again before AI features stopped working. For a self-hosted personal app, that was too much.

This ADR has been revised in place rather than deprecated because the underlying decision — "use a hosted vision-capable LLM via the user's own key" — has not changed. Only the provider has.

## Rationale (Gemini)

- **Free tier with no credit card** — Google AI Studio gives 1500 requests/day and 15 RPM on `gemini-2.5-flash` with just a Google account. This covers personal use comfortably and removes every billing-related onboarding step.
- **Vision capability** — Gemini identifies food and estimates portions reliably without fine-tuning, equivalent to Claude for HealthOS's needs.
- **Reasoning** — plan generation and coaching benefit from the model's contextual reasoning, not pattern matching.
- **Built-in JSON mode** — `generationConfig.responseMimeType: 'application/json'` enforces structured output at the API level, removing an entire class of "model returned markdown / preamble" failures.
- **Single REST call** — no SDK required, just `fetch` to one endpoint with the API key as a query parameter. Keeps the integration in `src/lib/ai/ai-client.ts` minimal and easy to read.
- **User's own key** — no shared key to protect, no cost to the developer, full privacy.
- **No infrastructure** — no self-hosted model server, no GPU cost.
- **Easy to swap** — if Anthropic later releases an OAuth flow or a free tier, we can revisit this decision by changing the provider in `ai-client.ts` only; everything else (prompts, Zod schemas, feature hooks) is provider-neutral.

## Consequences

- Users must obtain a Google account and a free Gemini API key from `https://aistudio.google.com/apikey` (onboarding explains this and links directly).
- AI features depend on Gemini's free-tier availability and rate limits (1500 req/day, 15 RPM as of 2026-04). Manual entry fallback covers offline / no-key / over-quota scenarios.
- The app is dependent on Google's API stability and pricing for the free tier. If Google changes the free tier terms, users can switch providers by replacing `ai-client.ts`.
- Prompt files no longer need explicit "respond with JSON only, no markdown" instructions — `responseMimeType: 'application/json'` enforces it.
