# ADR 003 — Claude API (claude-sonnet-4-6) for all AI features

**Status:** Accepted

## Decision

Use Anthropic's Claude API (`claude-sonnet-4-6`) for food scanning, workout plan generation, and coaching. Each user provides their own API key.

## Rationale

- **Vision quality** — Claude identifies food and estimates portions reliably without fine-tuning
- **Reasoning** — plan generation and coaching require contextual reasoning a fine-tuned model would miss
- **Model-agnostic** — one constant to update if a better model is released
- **User's own key** — no shared key to protect, no cost to the developer, full privacy
- **No infrastructure** — no self-hosted model server, no GPU cost

## Consequences

- Users must obtain an Anthropic account and API key (onboarding explains this)
- AI features cost the user money per call (fractions of a cent for food scans)
- App is dependent on Anthropic's API availability and pricing
- Manual entry fallback covers offline / no-key scenarios
