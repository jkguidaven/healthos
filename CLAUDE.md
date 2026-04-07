# HealthOS — agent guide

Personal health app. React Native + Expo + TypeScript. Local-first SQLite. Claude API for AI features.
Primary goal: body recomposition. API key entered in-app, stored in SecureStore.

## Read these first

| File | When to read |
|---|---|
| `HEALTHOS_PROJECT_GUIDE.md` | Starting any task — architecture, tech stack, build phases |
| `HEALTHOS_UX_WIREFRAMES.md` | Building any screen — all 16 screens fully spec'd |
| `ai-prompts.md` | Touching anything in `src/lib/ai/` — exact prompts + Zod schemas |
| `api-key-flow.md` | Working on onboarding, settings, or the AI client |
| `canonical-feature-example.ts` | Building a new feature — copy this pattern exactly |
| `schema.ts` | Writing any database query — all table definitions |
| `infrastructure.ts` | Setting up `claude-client.ts`, test utils, CI, or PR template |
| `subagents.md` | Setting up `.claude/agents/` — schema reviewer, prompt tester, test writer |
| `decisions/` | Understanding why a key decision was made |

## Project map

```
app/                    Expo Router routes (thin re-exports, no logic)
src/features/           One folder per feature (onboarding, nutrition, workout, metrics, coach, dashboard, settings)
src/lib/ai/             Claude API client + prompt files
src/lib/db/             Drizzle schema + migrations + query files
src/lib/formulas/       Pure TypeScript health math (body fat, TDEE, macros)
src/components/         Shared UI components
src/stores/             Zustand slices
src/test-utils/         renderWithProviders, MSW server, setup
.claude/agents/         Subagent definitions (schema-reviewer, prompt-tester, test-writer)
.github/workflows/      CI (lint + type-check + test)
```

## Common commands

```bash
pnpm start              # Expo dev server
pnpm ios / android      # simulators
pnpm test               # Jest
pnpm lint               # ESLint + tsc
pnpm type-check         # tsc --noEmit
pnpm db:generate        # Drizzle migration (after schema changes)
pnpm db:migrate         # Apply migrations
pnpm prompt:test food-scan / workout-plan / coach
```

## Hard rules

- No `any` in TypeScript
- No raw SQL — Drizzle query builder only
- No direct `fetch()` to Anthropic — always `callClaude()` in `src/lib/ai/claude-client.ts`
- No logic in `app/` route files
- API key only in `expo-secure-store` via `src/lib/ai/api-key.ts` — never logged, never in Zustand
- Formulas in `src/lib/formulas/` are pure functions — no React, no Drizzle, no AI imports
- NativeWind Tailwind classes only — no `StyleSheet.create()`
- After schema changes: run `pnpm db:generate`, commit migration files
- After prompt changes: run `pnpm prompt:test <feature>` before committing

## Ask first before

- Installing new packages
- Changing `src/lib/db/schema.ts`
- Changing `app/_layout.tsx`
- Changing any file in `src/lib/ai/`
