# HealthOS — project guide

> Personal AI-powered health companion. Open-source, local-first, cross-platform (iOS + Android).
> Primary goal: **body recomposition** (simultaneous fat loss + muscle gain).
> API key is entered in-app at first launch — no `.env` files, no terminal setup required.

---

## Table of contents

1. [What this app does](#1-what-this-app-does)
2. [Design decisions and rationale](#2-design-decisions-and-rationale)
3. [Tech stack](#3-tech-stack)
4. [Project structure](#4-project-structure)
5. [Architecture overview](#5-architecture-overview)
6. [Database schema](#6-database-schema)
7. [AI integration design](#7-ai-integration-design)
8. [API key management](#8-api-key-management)
9. [Software engineering principles](#9-software-engineering-principles)
10. [Testing strategy](#10-testing-strategy)
11. [Build phases (roadmap)](#11-build-phases-roadmap)
12. [AI agent operating guide (CLAUDE.md / AGENTS.md)](#12-ai-agent-operating-guide)
13. [Recommended Claude skills](#13-recommended-claude-skills)
14. [Open-source conventions](#14-open-source-conventions)

---

## 1. What this app does

HealthOS is a personal mobile app that tracks nutrition, workouts, and body metrics — all powered by Claude AI. It is built for personal use first, with the codebase published open-source so others can self-host it with their own API key.

### Four core pillars

| Pillar | What it does |
|---|---|
| **Nutrition** | AI food photo scanner, calorie + macro log, meal suggestions, water intake |
| **Body metrics** | Body fat calculator (Navy/FFMI), BMI/BMR/TDEE, weight trend chart, measurement log |
| **Workouts** | AI-generated workout plans, session logger, exercise library (WGER), progressive overload tracking |
| **AI coach** | Daily check-ins synthesising all pillars, weekly digest, habit streaks, contextual nudges |

### Recomposition context

The app is tuned for body recomposition — not pure fat loss or pure bulk. This affects several design decisions:

- Macro targets default to high protein (~1g per lb bodyweight), moderate fat, remaining carbs
- Scale weight is surfaced as a trend, not a daily pass/fail — recomp stalls the scale
- Progress photos and tape measurements are elevated as primary progress indicators
- The AI coach system prompt explicitly understands recomp: surpluses on training days, slight deficit on rest days
- TDEE calculation uses activity level from profile, not a fixed multiplier

---

## 2. Design decisions and rationale

### Local-first, no backend

All data lives in SQLite on the device. There is no server, no auth, no cloud sync. Rationale:

- This is a personal tool; no user data should leave the device except for AI API calls
- Eliminates infrastructure cost and maintenance burden
- Makes the open-source project genuinely self-contained — contributors fork, add their API key, run
- SQLite with Drizzle ORM gives type-safe queries and versioned migrations with zero ceremony

### Claude API for AI features, not a fine-tuned model

All AI features (food vision, workout plan generation, coaching) call `claude-sonnet-4-6` via the Anthropic API. Rationale:

- Claude's vision capability is production-grade for food identification without fine-tuning
- Plan generation and coaching benefit from Claude's reasoning, not pattern matching
- Keeps the app model-agnostic if Anthropic releases better models — just update the model string
- The API key is entered by the user inside the app on first launch — no environment variables, no terminal

### API key stored in device secure enclave, not environment variables

The Anthropic API key is collected during onboarding and stored in `expo-secure-store`, which uses iOS Keychain and Android Keystore. Rationale:

- Makes the app genuinely shareable: download, open, paste key, go — no developer tooling required
- Keys stored in the secure enclave are encrypted at rest and inaccessible to other apps
- Eliminates the entire `.env` / `EAS Secrets` complexity for personal open-source use
- Contributors and users are completely decoupled — each person uses their own key, their own data

### React Native + Expo (managed workflow)

Cross-platform from one TypeScript codebase. Expo managed workflow chosen because:

- Expo Camera, FileSystem, Notifications, and SQLite cover all native feature requirements
- EAS Build handles iOS + Android distribution without maintaining native Xcode/Gradle configs
- No custom native modules needed — if that changes, eject to bare workflow
- Expo Router for file-based navigation (same mental model as Next.js App Router)

### Drizzle ORM over raw SQL

Drizzle is used on top of `expo-sqlite` rather than writing raw SQL strings. Rationale:

- Type-safe schema definition in TypeScript — the schema is the single source of truth
- `useLiveQuery` hook auto-updates component state when underlying SQLite data changes
- Drizzle Studio Expo dev plugin gives a browser-based DB inspector during development
- Migration files are generated by `drizzle-kit` and committed to the repo — schema changes are tracked

### Zustand over Redux

Lightweight global state for UI-layer state (current day's log, active workout session, user profile cache). Rationale:

- No boilerplate; stores are plain TypeScript objects with actions co-located
- Persist middleware with `expo-sqlite/kv-store` handles cross-session state for preferences
- SQLite via Drizzle is the source of truth for all persisted data — Zustand only caches what the UI needs right now

### React Query for AI call lifecycle

All Claude API calls go through `@tanstack/react-query`. Rationale:

- Loading, error, and success states handled declaratively
- Automatic retry on transient network errors
- Caching prevents redundant AI calls for the same food photo within a session
- Mutation pattern gives clean optimistic updates for the food log

---

## 3. Tech stack

```
Platform:     React Native 0.79+ via Expo SDK 53+
Language:     TypeScript (strict mode)
Navigation:   Expo Router (file-based, App Router pattern)
Styling:      NativeWind (Tailwind CSS for React Native)
State:        Zustand (UI state) + Drizzle live queries (persistent data)
Database:     expo-sqlite + Drizzle ORM + drizzle-kit (migrations)
Key storage:  expo-secure-store (iOS Keychain / Android Keystore)
AI:           Anthropic Claude API (claude-sonnet-4-6) — vision + text
Nutrition DB: Open Food Facts API (barcode fallback, free)
Exercise DB:  WGER REST API (exercise library, free open-source)
Charts:       Victory Native XL (health data visualisation)
Forms:        react-hook-form + Zod (validation)
Testing:      jest-expo + React Native Testing Library + MSW
Camera:       expo-camera
Filesystem:   expo-file-system (progress photos)
Notifications: expo-notifications (reminders)
Build:        EAS Build (iOS + Android)
```

### Key package versions (pin these)

```json
{
  "expo": "~53.0.0",
  "react-native": "0.79.x",
  "expo-router": "~4.0.0",
  "expo-sqlite": "~15.0.0",
  "expo-secure-store": "~14.0.0",
  "drizzle-orm": "^0.38.0",
  "zustand": "^5.0.0",
  "@tanstack/react-query": "^5.0.0",
  "nativewind": "^4.0.0",
  "zod": "^3.22.0",
  "react-hook-form": "^7.50.0"
}
```

---

## 4. Project structure

Feature-based organisation. Routes are thin re-export layers; all logic lives in `src/features/`.

```
healthos/
├── app/                          # Expo Router file-based routes (thin re-exports only)
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # → features/dashboard
│   │   ├── food.tsx              # → features/nutrition
│   │   ├── workout.tsx           # → features/workout
│   │   ├── metrics.tsx           # → features/metrics
│   │   └── coach.tsx             # → features/coach
│   ├── onboarding/
│   │   └── index.tsx             # → features/onboarding
│   ├── settings/
│   │   └── index.tsx             # → features/settings
│   ├── food/
│   │   └── scan.tsx              # → features/nutrition/scan-screen
│   └── _layout.tsx               # Root layout, SQLiteProvider, QueryClientProvider
│
├── src/
│   ├── features/                 # One folder per product feature
│   │   ├── onboarding/
│   │   │   ├── onboarding-screen.tsx   # Step controller (profile → api-key → done)
│   │   │   ├── profile-form.tsx        # Step 1: biometrics + goal
│   │   │   ├── api-key-step.tsx        # Step 2: key input, validation, save
│   │   │   ├── use-onboarding.ts
│   │   │   └── types.ts
│   │   ├── settings/
│   │   │   ├── settings-screen.tsx
│   │   │   ├── api-key-settings.tsx    # View (masked) / update / clear key
│   │   │   ├── use-api-key.ts          # Read, save, validate, clear via SecureStore
│   │   │   └── types.ts
│   │   ├── nutrition/
│   │   │   ├── nutrition-screen.tsx
│   │   │   ├── food-scan-screen.tsx
│   │   │   ├── food-log-list.tsx
│   │   │   ├── macro-rings.tsx
│   │   │   ├── use-food-log.ts
│   │   │   ├── use-food-scanner.ts   # Claude vision call
│   │   │   └── types.ts
│   │   ├── workout/
│   │   │   ├── workout-screen.tsx
│   │   │   ├── session-logger.tsx
│   │   │   ├── plan-view.tsx
│   │   │   ├── use-workout-plan.ts   # Claude plan gen call
│   │   │   ├── use-session.ts
│   │   │   └── types.ts
│   │   ├── metrics/
│   │   │   ├── metrics-screen.tsx
│   │   │   ├── body-fat-form.tsx
│   │   │   ├── weight-chart.tsx
│   │   │   ├── use-metrics.ts
│   │   │   ├── body-fat-calculator.ts  # Pure functions, Navy + FFMI
│   │   │   └── types.ts
│   │   ├── coach/
│   │   │   ├── coach-screen.tsx
│   │   │   ├── daily-checkin.tsx
│   │   │   ├── weekly-digest.tsx
│   │   │   ├── use-coach.ts          # Claude coaching call
│   │   │   └── types.ts
│   │   └── dashboard/
│   │       ├── dashboard-screen.tsx
│   │       ├── daily-summary-card.tsx
│   │       └── use-dashboard.ts
│   │
│   ├── components/               # Shared UI components (used by 2+ features)
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── progress-ring.tsx
│   │   │   └── avatar.tsx
│   │   └── layouts/
│   │       ├── screen-layout.tsx
│   │       └── tab-bar.tsx
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── claude-client.ts      # Anthropic API wrapper — reads key from SecureStore
│   │   │   ├── api-key.ts            # SecureStore read/write/validate helpers
│   │   │   ├── prompts/
│   │   │   │   ├── food-scan.ts
│   │   │   │   ├── workout-plan.ts
│   │   │   │   └── coach.ts
│   │   │   └── types.ts              # AIError, APIKeyError, APIKeyMissingError
│   │   ├── db/
│   │   │   ├── schema.ts
│   │   │   ├── migrations/
│   │   │   └── queries/
│   │   │       ├── food-log.ts
│   │   │       ├── workouts.ts
│   │   │       ├── metrics.ts
│   │   │       └── profile.ts
│   │   └── formulas/
│   │       ├── body-fat.ts
│   │       ├── tdee.ts
│   │       ├── macros.ts
│   │       └── constants.ts
│   │
│   ├── stores/
│   │   ├── profile-store.ts
│   │   ├── session-store.ts
│   │   └── ui-store.ts               # Includes hasApiKey: boolean
│   │
│   ├── hooks/
│   │   ├── use-today-summary.ts
│   │   └── use-network-status.ts
│   │
│   └── types/
│       ├── database.ts
│       ├── ai.ts
│       └── navigation.ts
│
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── ai-prompts.md
│   ├── api-key-flow.md               # ← new: full API key lifecycle doc
│   ├── formulas.md
│   └── decisions/
│       ├── 001-local-first.md
│       ├── 002-drizzle-over-raw-sql.md
│       ├── 003-claude-api-model.md
│       └── 004-in-app-api-key.md     # ← new: ADR for in-app key management
│
├── CLAUDE.md
├── AGENTS.md
├── app.json
├── drizzle.config.ts
├── babel.config.js
└── tsconfig.json
```

---

## 5. Architecture overview

```
┌─────────────────────────────────────────────┐
│                 Expo Router                  │
│         (app/ — thin route files)           │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Feature screens                 │
│    (src/features/*/ — screens + hooks)      │
└──────┬──────────────────────┬───────────────┘
       │                      │
┌──────▼──────┐     ┌─────────▼──────────────┐
│  Zustand    │     │    React Query          │
│  (UI cache) │     │  (AI call lifecycle)    │
└─────────────┘     └─────────┬──────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌──────▼──────┐  ┌─────▼──────────┐
    │  Claude API    │  │  Open Food  │  │   WGER API     │
    │ (vision+text)  │  │  Facts API  │  │ (exercise DB)  │
    └────────────────┘  └─────────────┘  └────────────────┘

┌─────────────────────────────────────────────┐
│           Drizzle ORM + expo-sqlite          │
│     (src/lib/db/ — schema + queries)        │
│        All data stays on-device             │
└─────────────────────────────────────────────┘
```

### Data flow: food photo scan

```
User taps camera
  → expo-camera captures frame
  → base64 encode image
  → React Query mutation fires
  → claude-client.ts: POST /v1/messages (image + food-scan system prompt)
  → Claude returns structured JSON: { name, calories, protein, carbs, fat, confidence }
  → Zod validates response schema
  → Drizzle inserts FoodLog row
  → useLiveQuery updates the macro rings on screen
  → Zustand updates today's running totals in UI cache
```

### Data flow: workout plan generation

```
User fills plan form (goal, equipment, days/week, experience)
  → React Query mutation fires
  → claude-client.ts: POST /v1/messages (profile + workout-plan system prompt)
  → Claude returns structured JSON: { weeks, days: [{ name, exercises: [...] }] }
  → Zod validates schema
  → Drizzle inserts WorkoutPlan + WorkoutDay + Exercise rows
  → Expo Router navigates to plan view
```

---

## 6. Database schema

Full Drizzle schema lives at `src/lib/db/schema.ts`. Agent-readable reference at `docs/database-schema.md`.

### Tables

```
profile           — one row; user's biometric data and goal
food_log          — daily nutrition entries (AI-scanned or manual)
workout_plan      — generated plan metadata
workout_day       — days within a plan
plan_exercise     — exercises within a day (sets, reps, rest)
session           — completed workout session header
session_set       — logged sets within a session (weight, reps, completed)
body_metric       — daily weight + optional measurements (waist, hip, chest, arm, thigh)
water_log         — daily hydration entries
progress_photo    — file URI references + date
coach_entry       — daily AI coaching responses (cached, not re-generated)
```

### Key schema decisions

- All `id` fields are `INTEGER PRIMARY KEY AUTOINCREMENT` — keeps foreign keys simple
- Dates stored as `TEXT` in ISO 8601 (`YYYY-MM-DD`) — no timezone complexity for a personal local app
- Weights stored as `REAL` in kg internally; UI layer handles display unit conversion
- `coach_entry` caches the daily AI response to avoid re-calling Claude on re-open
- `progress_photo` stores a file URI from `expo-file-system` — the photo itself never touches a server

---

## 7. AI integration design

### API client pattern

All Claude calls go through `src/lib/ai/claude-client.ts`. This is the only file that reads the API key — via `expo-secure-store`, not `process.env`. No feature code calls `fetch` directly and no feature code touches the key.

```typescript
// src/lib/ai/claude-client.ts
export async function callClaude<T>(params: {
  system: string
  userMessage: string | ContentBlock[]
  schema: z.ZodType<T>
  maxTokens?: number
}): Promise<T>
```

Every call:
1. Reads the API key from SecureStore via `getApiKey()` in `src/lib/ai/api-key.ts`
2. Throws `APIKeyMissingError` if no key is stored — the UI handles this as a prompt to configure the key
3. Constructs the request with the system prompt from `src/lib/ai/prompts/`
4. Posts to `https://api.anthropic.com/v1/messages` with `claude-sonnet-4-6`
5. Parses and Zod-validates the response
6. Throws a typed `AIError` on failure so React Query can surface it correctly

### Prompt files

Each AI feature has its own prompt file. Prompts are functions that take context and return the final prompt string — never hardcoded strings scattered across feature code.

#### `src/lib/ai/prompts/food-scan.ts`

```typescript
export function buildFoodScanPrompt(userContext?: string): string
// System: instructs Claude to identify food, estimate macros, return JSON
// Returns strict JSON schema: { name, calories, protein_g, carbs_g, fat_g, confidence, notes }
// Confidence: "high" | "medium" | "low" — shown in UI so user can override
```

#### `src/lib/ai/prompts/workout-plan.ts`

```typescript
export function buildWorkoutPlanPrompt(profile: Profile, planRequest: PlanRequest): string
// System: sports science principles, recomp-aware programming
// Includes profile context: age, sex, weight, goal, experience, equipment, days/week
// Returns JSON: { planName, weeks, daysPerWeek, days: WorkoutDay[] }
```

#### `src/lib/ai/prompts/coach.ts`

```typescript
export function buildDailyCoachPrompt(context: CoachContext): string
// CoachContext includes: profile, todayNutrition, lastWorkout, last7DaysMetrics, streak
// System: recomp-aware coach — understands that scale stall ≠ failure
// Returns: { message, insights: string[], actionItems: string[], mood: 'great'|'good'|'check-in' }
```

### Recomp-specific AI instructions

The coach system prompt includes these explicit instructions:

```
You are a body recomposition coach. The user is simultaneously building muscle and losing fat.
Key principles you always apply:
- Scale weight fluctuates ±2kg from water/glycogen — do not treat daily weigh-ins as fat loss/gain
- High protein (>1.6g/kg) is non-negotiable for recomp — flag if user is consistently under
- Training days may show a slight caloric surplus; rest days a slight deficit — this is correct
- Progress is measured over 4-week trends, not day-to-day
- Muscle gain is slow (~0.5-1kg/month for naturals) — set realistic expectations
- Body measurements and performance (strength gains) are better short-term indicators than weight
```

### Structured output validation

Every Claude response is validated with Zod before touching the database. If Claude returns malformed JSON, the error is caught, logged, and surfaced to the user with a retry option — the app never silently corrupts the database.

```typescript
const FoodScanResult = z.object({
  name: z.string(),
  calories: z.number().positive(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  confidence: z.enum(['high', 'medium', 'low']),
  notes: z.string().optional(),
})
```

---

## 8. API key management

Full flow documented in `docs/api-key-flow.md`. This section is the authoritative summary.

### Storage

The Anthropic API key is stored exclusively in `expo-secure-store` under the key `'anthropic_api_key'`. It is never written to SQLite, AsyncStorage, or any file on disk. It never appears in logs, state dumps, or crash reports.

```typescript
// src/lib/ai/api-key.ts

const SECURE_STORE_KEY = 'anthropic_api_key' as const

export async function getApiKey(): Promise<string | null>
export async function saveApiKey(key: string): Promise<void>
export async function clearApiKey(): Promise<void>
export async function validateApiKey(key: string): Promise<ValidationResult>
// ValidationResult: { valid: boolean; error?: 'invalid_key' | 'network_error' | 'rate_limit' }
```

`validateApiKey` makes a minimal call to `/v1/messages` (`max_tokens: 1`, single-word prompt) to confirm the key is accepted before saving. It does not store the key if validation fails.

### Onboarding flow

Onboarding is a two-step flow controlled by `onboarding-screen.tsx`:

```
Step 1 — Profile form
  age, sex, height, weight, goal, activity level, equipment available
  → saves to SQLite profile table on submit

Step 2 — API key
  → explains what the key is (2 sentences)
  → links to https://console.anthropic.com
  → masked TextInput (secureTextEntry)
  → "Validate & Save" button
  → calls validateApiKey() — shows loading spinner
  → on success: saves key, sets hasApiKey = true in ui-store, navigates to dashboard
  → on failure: shows inline error with specific message per error code
```

The onboarding screen is shown when `profile` table is empty OR `hasApiKey` is false. Both conditions must be satisfied before the main app is accessible.

### Runtime key check

`claude-client.ts` calls `getApiKey()` at the start of every AI request. If it returns `null`:

1. Throws `APIKeyMissingError`
2. React Query surfaces this as an error state
3. The feature screen shows a banner: "API key not configured — [Go to Settings]"
4. The banner deep-links to `app/settings/index.tsx`

This means AI features degrade gracefully if the key is somehow lost (e.g. user clears app data) — the app remains usable for manual logging and metrics.

### Settings screen

`src/features/settings/api-key-settings.tsx` provides:

- Masked display of the stored key (`sk-ant-...••••••••` showing first 10 chars only)
- "Update key" — opens the same input + validation flow as onboarding
- "Remove key" — calls `clearApiKey()`, sets `hasApiKey = false`, navigates back to onboarding step 2
- A direct link to `https://console.anthropic.com` to get or rotate keys

### Zustand profile store

```typescript
// src/stores/ui-store.ts
interface UIStore {
  hasApiKey: boolean
  setHasApiKey: (value: boolean) => void
}
```

`hasApiKey` is hydrated at app boot by reading from SecureStore (not from SQLite). It is the single boolean that gates all AI feature UI — components check this before rendering AI-dependent controls, rather than hitting SecureStore on every render.

### What never happens

- The key is never logged with `console.log`
- The key is never passed as a prop to any component
- The key is never stored in Zustand state (only `hasApiKey: boolean` is stored)
- The key is never included in error reports or analytics
- There is no `.env` file, no `EAS_SECRET`, no `expo-constants` config

---

## 9. Software engineering principles

### Principles applied throughout this codebase

**Single responsibility** — each file does one thing. `body-fat-calculator.ts` only calculates body fat. It does not touch the database, call APIs, or know about React. This makes it trivially testable and easy to swap formulas.

**Separation of concerns** — UI components do not query the database directly. Feature hooks (`use-food-log.ts`) own data fetching and mutations. Components receive data as props or call hooks — never Drizzle directly.

**Pure functions for formulas** — all health math lives in `src/lib/formulas/` as pure TypeScript functions with no side effects. Input in, number out. These are the most heavily unit-tested files.

**Schema as single source of truth** — `src/lib/db/schema.ts` is the authoritative definition of all data structures. Types are inferred from the schema via `typeof schema.$inferSelect`. No manual type duplication.

**Fail loudly** — AI response validation throws typed errors, not silent failures. Database migrations fail the app boot rather than silently running on a corrupt schema. This surfaces bugs during development, not in production.

**No magic numbers** — nutrition constants (calories per gram of macro, TDEE multipliers, body fat formula coefficients) live in named constants in `src/lib/formulas/constants.ts` with source citations.

**Naming conventions**

```
Files:            kebab-case         food-scan-screen.tsx
Components:       PascalCase         FoodScanScreen
Hooks:            camelCase, use-    useFoodScanner
Types/Interfaces: PascalCase         FoodLogEntry
Constants:        SCREAMING_SNAKE    CALORIES_PER_GRAM_PROTEIN
Stores:           camelCase, Store   profileStore
```

**TypeScript rules**

- `strict: true` in `tsconfig.json`
- Prefer `interface` over `type` for object shapes
- No `any` — use `unknown` and narrow explicitly
- No enums — use `const` object maps or Zod enums
- All function parameters and return types explicitly annotated

**Path aliases** (configured in `tsconfig.json` + `babel.config.js`)

```
@/*         →  src/*
@db/*       →  src/lib/db/*
@ai/*       →  src/lib/ai/*
@formulas/* →  src/lib/formulas/*
@features/* →  src/features/*
@components/* → src/components/*
```

---

## 10. Testing strategy

### Test pyramid

```
E2E (Maestro)        ← happy-path flows only; run pre-release
  Integration        ← feature hook + DB queries; run on CI
    Unit             ← pure functions (formulas, parsers); run always
```

### Unit tests — pure functions first

All files in `src/lib/formulas/` and `src/lib/ai/prompts/` have 100% coverage. These are pure functions — test them like it.

```
src/lib/formulas/__tests__/
  body-fat.test.ts         # Navy method, FFMI — known inputs → expected outputs
  tdee.test.ts             # Mifflin-St Jeor for M/F, all activity levels
  macros.test.ts           # Recomp targets from TDEE
```

### Integration tests — DB queries

SQLite cannot run in Jest directly (native module). Pattern: abstract the executor interface (`SqlExecutor`) and test with `node:sqlite` or `better-sqlite3` in tests, while the app uses `expo-sqlite`. Query files in `src/lib/db/queries/` are tested this way.

Alternatively, use `expo-sqlite-mock` (`zfben/expo-sqlite-mock`) for simpler mock-based tests.

### Component tests — RNTL

```typescript
// Pattern for all component tests
import { renderWithProviders } from '@/test-utils'
// test-utils.tsx wraps with QueryClientProvider + SQLiteProvider mock + NavigationContainer
```

Mock AI calls with MSW (Mock Service Worker) — never hit the real Claude API in tests.

### Jest configuration

```typescript
// jest.config.ts
import type { Config } from 'jest'
const config: Config = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
  ],
  setupFilesAfterEnv: ['./src/test-utils/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
export default config
```

### Scripts

```bash
pnpm test              # run all unit tests
pnpm test:watch        # watch mode
pnpm test:coverage     # coverage report
pnpm lint              # ESLint + TypeScript check
pnpm type-check        # tsc --noEmit
```

---

## 11. Build phases (roadmap)

### Phase 0 — foundation (Day 1–2)

- `npx create-expo-app@latest healthos --template blank-typescript`
- Configure NativeWind, Expo Router, path aliases, ESLint, Prettier
- Set up Drizzle + expo-sqlite, write initial schema, run first migration
- Create `.env.example`, `CLAUDE.md`, `docs/` structure
- Confirm dev build runs on iOS simulator and Android emulator

### Phase 1 — onboarding + body metrics (Week 1)

- Onboarding flow: profile form (age, sex, height, weight, goal, activity level, equipment)
- TDEE + macro target calculation (pure functions, unit-tested)
- Body fat calculator: US Navy method (waist, neck, height inputs)
- Weight log: daily entry form + Victory Native trend chart (7d, 30d, 90d views)
- Measurement log: waist, hip, chest, arm, thigh — stored with date

Deliverable: a working app with no AI, fully usable for tracking basics.

### Phase 2 — AI food scanner + nutrition log (Week 2–3)

- `expo-camera` integration, permission handling
- `use-food-scanner.ts`: capture → base64 → Claude vision → Zod parse → Drizzle insert
- Macro rings UI (daily progress vs targets) using Victory Native
- Manual food entry form (fallback for when photo scan is uncertain)
- Barcode scan → Open Food Facts API lookup (no Claude call needed for packaged food)
- Daily food log list with edit/delete
- Water intake logger

Deliverable: the headline feature working end-to-end.

### Phase 3 — workout planner + session logger (Week 4–5)

- Plan request form: goal, equipment available, days/week, experience level
- `use-workout-plan.ts`: form data → Claude plan gen prompt → Zod parse → Drizzle insert
- Plan view: weekly schedule, exercise cards with sets/reps/rest
- WGER API integration: exercise lookup by name, animated GIF thumbnails
- Session logger: active workout screen, log each set (weight × reps), rest timer
- Progressive overload: surface last session's weights, highlight PRs

Deliverable: a complete workout planning + tracking loop.

### Phase 4 — AI coach + weekly digest (Week 6)

- Daily check-in: pulls today's nutrition, last workout, last 7d metrics → Claude coaching call → cached in `coach_entry`
- Coach screen: displays today's message + insights + action items
- Weekly digest: triggered on Sunday, summarises the full week, suggests adjustments
- Habit streaks: consecutive days of food logging, workout completion, water goal
- Push notifications (expo-notifications): morning weigh-in reminder, workout reminder, water reminder
- Progress photo capture + gallery view (local only)

Deliverable: the full four-pillar app.

---

## 12. AI agent operating guide

> **This section is the content of `CLAUDE.md` and `AGENTS.md` at the repo root.**
> Copy it verbatim into those files when initialising the repo.

---

### CLAUDE.md

```markdown
# HealthOS — agent guide

Personal health app. React Native + Expo + TypeScript. Local-first SQLite. Claude API for AI features.

## Project map
- `app/` — Expo Router routes (thin re-exports only, no logic here)
- `src/features/` — all product feature code
- `src/lib/ai/` — Claude API client and prompt files
- `src/lib/db/` — Drizzle schema, migrations, query files
- `src/lib/formulas/` — pure TypeScript health math (body fat, TDEE, macros)
- `src/components/` — shared UI components
- `src/stores/` — Zustand slices
- `docs/` — architecture docs, schema reference, ADRs

See `docs/architecture.md` for the full system diagram.
See `docs/database-schema.md` for table definitions.
See `docs/ai-prompts.md` for prompt design decisions.

## Common commands
```bash
pnpm start              # start Expo dev server
pnpm ios                # run on iOS simulator
pnpm android            # run on Android emulator
pnpm test               # Jest unit tests
pnpm lint               # ESLint + tsc check
pnpm db:generate        # drizzle-kit generate (after schema changes)
pnpm db:migrate         # apply migrations
```

## Code conventions
- TypeScript strict mode — no `any`
- Prefer `interface` over `type` for objects
- Named exports only — no default exports except screen components
- No raw SQL — use Drizzle query builder
- No direct `fetch` to Claude API — always use `src/lib/ai/claude-client.ts`
- No logic in `app/` route files — screens live in `src/features/`
- Formulas in `src/lib/formulas/` are pure functions — no side effects, fully unit-tested

## Naming
- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Hooks: `useCamelCase`
- Types: `PascalCase`
- DB query files: `src/lib/db/queries/<feature>.ts`

## Testing
- New formula or utility function → add unit test in `__tests__/` next to the file
- New feature hook → add integration test using MSW for API mocks
- Run `pnpm test` before any commit; must pass

## AI calls
- All Claude calls go through `callClaude()` in `src/lib/ai/claude-client.ts`
- `claude-client.ts` reads the API key from SecureStore via `getApiKey()` in `src/lib/ai/api-key.ts`
- Every response is Zod-validated — never trust raw Claude output
- Prompt strings live in `src/lib/ai/prompts/` — never inline prompt strings in feature code
- Model: `claude-sonnet-4-6`

## API key rules
- The key is stored ONLY in expo-secure-store under `'anthropic_api_key'`
- Never log the key, pass it as a prop, or put it in Zustand state
- `hasApiKey: boolean` in ui-store is the only key-related value in global state
- On `APIKeyMissingError` → deep-link to settings, never crash
- On `APIKeyInvalidError` → show inline error, deep-link to settings
- See `docs/api-key-flow.md` for the full lifecycle

## Safety
- No `.env` file — the API key is entered in-app and stored in SecureStore
- No secrets in the repo — nothing to accidentally commit
- All user data stays on-device — external calls: Claude API + Open Food Facts + WGER only

## Ask first before
- Installing new packages
- Changing the Drizzle schema (always regenerate migrations after)
- Modifying `app/_layout.tsx` (root layout, affects the whole app)
- Changing the Claude prompt files (test with real API before committing)
- Changing anything in `src/lib/ai/api-key.ts` (security-sensitive)
```

---

### Subdirectory AGENTS.md files

Place a scoped `AGENTS.md` in these directories for additional context:

**`src/lib/ai/AGENTS.md`**
```markdown
This directory owns all Claude API integration.
- `api-key.ts` is the ONLY file that reads from or writes to SecureStore for the API key
- `claude-client.ts` calls `getApiKey()` from api-key.ts — it never reads process.env or any config
- Never log, prop-drill, or store the raw key string anywhere outside api-key.ts
- All responses must be Zod-validated before use
- Prompt files are functions, not string constants — they take context params
- Model string: claude-sonnet-4-6 — update here if model changes
- Never add retry logic here — React Query handles retries at the call site
- APIKeyMissingError and APIKeyInvalidError are distinct — handle both differently in the UI layer
- See docs/api-key-flow.md for the full key lifecycle
```

**`src/lib/db/AGENTS.md`**
```markdown
Database layer. Drizzle ORM on expo-sqlite.
- Schema changes require running: pnpm db:generate && pnpm db:migrate
- Migrations are auto-generated and committed — do not hand-edit them
- Query files in queries/ use Drizzle query builder only — no raw SQL strings
- useLiveQuery from drizzle-orm/expo-sqlite provides reactive queries
- Dates stored as TEXT in YYYY-MM-DD format
- Weights stored as REAL in kg — unit conversion is a UI concern
```

**`src/lib/formulas/AGENTS.md`**
```markdown
Pure TypeScript health math. No imports from React, Drizzle, or AI.
- body-fat.ts: US Navy method + FFMI
- tdee.ts: Mifflin-St Jeor BMR + activity multiplier
- macros.ts: recomp-aware macro targets from TDEE + profile
- constants.ts: all magic numbers with source citations
- Every file here has a co-located __tests__/ unit test
- These are the highest-priority files to keep correct and tested
```

---

## 13. Recommended Claude skills

### Skills to create for this project

These are custom `SKILL.md` files to add to `.claude/skills/` in the repo, following Claude Code's skill format (under 150 lines each, focused on a single domain).

---

#### `react-native-expo.md`

**Trigger when:** creating new screens, hooks, or components in `src/`.

Key rules to encode:
- Use functional components with TypeScript interfaces (never class components)
- Hooks follow the `use-` prefix convention and live in the feature folder
- `StyleSheet.create()` is not used — NativeWind Tailwind classes only
- `FlatList` requires `keyExtractor`, `removeClippedSubviews`, `maxToRenderPerBatch` for long lists
- `expo-camera` requires permission check before render — always use `useCameraPermissions()`
- Safe area is handled by `expo-router`'s default layout — do not double-wrap with `SafeAreaView`
- Navigation: use `router.push()`, `router.replace()`, `useLocalSearchParams()` from `expo-router`

---

#### `drizzle-sqlite.md`

**Trigger when:** modifying schema, writing queries, or working in `src/lib/db/`.

Key rules to encode:
- Schema changes: edit `schema.ts` → run `pnpm db:generate` → commit migration files → run `pnpm db:migrate`
- Always use `useLiveQuery` for queries that need to reactively update the UI
- Use `db.transaction()` for multi-table writes (e.g., inserting a workout plan + its days + exercises)
- Types: use `typeof table.$inferSelect` and `typeof table.$inferInsert` — never duplicate type definitions
- No raw SQL — if Drizzle query builder can't express it, open an issue and discuss before hand-writing SQL

---

#### `claude-api-integration.md`

**Trigger when:** modifying `src/lib/ai/` or any code that calls Claude.

Key rules to encode:
- All calls go through `callClaude()` — never `fetch` directly
- Prompt functions accept typed parameters and return a string — no template literals in feature code
- Always add a Zod schema for the expected response before writing the prompt
- Use `max_tokens: 1024` for food scans, `4096` for workout plan generation, `2048` for coaching
- Food scan images: resize to max 1024px longest side before base64 encoding (reduces tokens)
- Error handling: `AIError` with `code: 'parse_error' | 'api_error' | 'rate_limit' | 'key_missing' | 'key_invalid'` — each surfaced differently in UI:
  - `key_missing` → deep-link to Settings > API Key screen
  - `key_invalid` → show inline error with link to settings ("Your API key was rejected — update it in Settings")
  - `rate_limit` → show retry banner with cooldown timer
  - `api_error` → show generic retry option
  - `parse_error` → show "Claude returned an unexpected response, try again"

---

#### `health-formulas.md`

**Trigger when:** working in `src/lib/formulas/` or adding new health calculations.

Key rules to encode:
- US Navy body fat formula for males: `495 / (1.0324 - 0.19077 × log10(waist - neck) + 0.15456 × log10(height)) - 450`
- US Navy body fat formula for females: `495 / (1.29579 - 0.35004 × log10(waist + hip - neck) + 0.22100 × log10(height)) - 450`
- Mifflin-St Jeor BMR: males `10×weight(kg) + 6.25×height(cm) - 5×age + 5`, females same minus 161
- TDEE activity multipliers: sedentary 1.2, light 1.375, moderate 1.55, active 1.725, very active 1.9
- Recomp macro targets: protein = 2.2g/kg bodyweight, fat = 25% of TDEE, carbs = remainder
- All measurements input in metric internally; display layer handles imperial conversion
- Add unit tests for all boundary values (zero weight, extreme ages, minimum measurements)

---

### Public skills to enable

From the Claude skills registry, enable these for the project:

| Skill | Why |
|---|---|
| `frontend-design` | When building new UI components — enforces distinctive, non-generic mobile UI aesthetics |
| `file-reading` | When reading uploaded design files, screenshots, or PDFs for reference |

> Note: the `frontend-design` skill applies to web artifacts and HTML/React components. For React Native UI, use the custom `react-native-expo.md` skill above instead, as NativeWind + RN primitives differ from web CSS.

---

## 14. Open-source conventions

### Repository setup

```
README.md             — project overview, screenshots, quick start
CONTRIBUTING.md       — how to contribute (fork, branch, PR)
LICENSE               — MIT
CHANGELOG.md          — semver changelog (keep manually or with standard-version)
.github/
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
  pull_request_template.md
```

> No `.env` file, no `.env.example`, no secrets of any kind in the repository.
> The API key is entered by the user inside the app. This is intentional — see `docs/decisions/004-in-app-api-key.md`.

### README quick-start (for users)

The README should reflect the zero-config setup experience:

```
1. Clone the repo
2. pnpm install
3. npx expo start (or use EAS Build for a device build)
4. Open the app → enter your Anthropic API key when prompted
   → Get a key at https://console.anthropic.com
5. Complete your profile → start logging
```

No mention of `.env`, `EAS Secrets`, or environment variables anywhere in the user-facing docs.

### Commit convention

Follow Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`

### Branch strategy (solo project)

```
main          — always deployable
feat/*        — feature branches
fix/*         — bug fixes
```

### PR checklist (encoded in `CLAUDE.md`)

```
- [ ] pnpm lint passes
- [ ] pnpm test passes
- [ ] pnpm type-check passes
- [ ] If schema changed: migration files committed
- [ ] If prompt changed: tested against real Claude API
- [ ] No secrets or keys anywhere in the diff
- [ ] If api-key.ts changed: security review — does it still only write to SecureStore?
```

---

*Last updated: April 2026. Generated as part of HealthOS project planning session.*
