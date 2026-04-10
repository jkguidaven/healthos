# HealthOS — agent guide

Personal health app. React Native + Expo + TypeScript. Local-first SQLite. Gemini API for AI features.
Primary goal: body recomposition. API key entered in-app, stored in SecureStore.

## Read these first

| File | When to read |
|---|---|
| `HEALTHOS_PROJECT_GUIDE.md` | Starting any task — architecture, tech stack, build phases |
| `HEALTHOS_UX_WIREFRAMES.md` | Building any screen — all 16 screens fully spec'd |
| `ai-prompts.md` | Touching anything in `src/lib/ai/` — exact Gemini prompts + Zod schemas |
| `api-key-flow.md` | Working on onboarding, settings, or the AI client (Gemini key lifecycle) |
| `canonical-feature-example.ts` | Building a new feature — copy this pattern exactly |
| `schema.ts` | Writing any database query — all table definitions |
| `infrastructure.ts` | Setting up `ai-client.ts`, test utils, CI, or PR template |
| `subagents.md` | Setting up `.claude/agents/` — schema reviewer, prompt tester, test writer |
| `decisions/` | Understanding why a key decision was made |

## Project map

```
app/                    Expo Router routes (thin re-exports, no logic)
src/features/           One folder per feature (onboarding, nutrition, workout, metrics, coach, dashboard, settings)
src/lib/ai/             Gemini API client + prompt files
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
- No direct `fetch()` to the AI provider — always `callAI()` in `src/lib/ai/ai-client.ts`
- No logic in `app/` route files
- API key only in `expo-secure-store` via `src/lib/ai/api-key.ts` — never logged, never in Zustand
- Formulas in `src/lib/formulas/` are pure functions — no React, no Drizzle, no AI imports
- NativeWind Tailwind classes only — no `StyleSheet.create()`
- After schema changes: run `pnpm db:generate`, commit migration files
- After prompt changes: run `pnpm prompt:test <feature>` before committing
- **Platform guards for native-only APIs** — before using any `expo-*` or `react-native-*` API, verify it supports iOS, Android, AND web. If it doesn't (e.g. `expo-secure-store`, `expo-haptics`, `expo-notifications`, `expo-camera` web limits), wrap the call behind a `Platform.OS` branch with a working fallback for the unsupported platforms (e.g. `localStorage` for storage on web). Keep the platform branching inside the lowest-level wrapper module so feature code stays platform-agnostic. Past incident: `expo-secure-store` was called directly in `api-key.ts` and crashed the web build at boot with `ExpoSecureStore.default.getValueWithKeyAsync is not a function`.
- **Use `npx expo install` for all Expo and React Native packages** — never `pnpm add` them directly. `npx expo install` resolves the version that matches the installed Expo SDK; `pnpm add` pulls latest, which is almost always wrong (e.g. installs SDK 55 packages onto an SDK 54 project). After installing, verify with `npx expo install --check`. If the warning ever appears, run `npx expo install --fix` to realign every drifted package in one shot. This applies to: anything starting with `expo-`, `@expo/`, `react-native-`, `react-native`, `react`, and any package the Expo team manages compatibility for (e.g. `react-native-svg`, `react-native-screens`, `react-native-safe-area-context`, `react-native-reanimated`, `jest-expo`).
- **Always invoke the `frontend-design` skill before building or modifying any UI** — screens, components, modals, layouts, anything visual. The skill enforces distinctive, production-grade aesthetics and avoids generic AI defaults. Generic centered cards, default Tailwind grays, plain "screen title + form fields + button" stacks are NOT acceptable. Every screen should have intentional hierarchy, considered spacing, real visual weight, and feel like something a senior product designer signed off on. The wireframe specs in `HEALTHOS_UX_WIREFRAMES.md` describe layout structure, not aesthetic — go beyond the minimum and make it look polished.

## Design system

HealthOS is a **friendly consumer health & fitness app**, not an editorial magazine, dark cockpit dashboard, or athletic-brutalist tool. Reference inspiration: Capi Creative health apps, Apple Health, Headspace, Calm — clean, mint-tinted, rounded everything, friendly typography, generous whitespace.

**Vibe in three words:** *Soft. Friendly. Clean.*

### Color palette (in `tailwind.config.js`)

- **Mint scale** (`mint-50` through `mint-700`) — primary brand color, used for backgrounds, gradients, and primary actions. `mint-400`/`mint-500` are the hero shades.
- **Slate scale** (`slate-50` through `slate-900`) — text and surfaces. `slate-900` for primary text, `slate-600` for secondary, `slate-400` for tertiary, `slate-100`/`slate-50` for faint surfaces, `slate-0` (white) for cards.
- **Brand pillars** (`brand-green`, `brand-purple`, `brand-amber`, `brand-coral`, `brand-blue`) — used contextually for data accents (macro colors, confidence badges), NOT for primary UI chrome.

### Typography — Poppins only

- `font-sans` (Poppins Regular 400) — body text
- `font-sans-medium` (Poppins Medium 500) — emphasis
- `font-sans-semibold` (Poppins SemiBold 600) — buttons, sub-headings
- `font-sans-bold` (Poppins Bold 700) — headlines, hero text

NO serifs. NO mono. NO display fonts. NO uppercase letter-spaced kickers. NO "EST. 2026" / "CHAPTER ONE" / editorial moves. Just Poppins, mostly bold weights for hierarchy.

Headline sizes: 28-36px, line-height ~1.15, letter-spacing slightly negative (-0.5).
Body sizes: 14-15px, line-height ~1.5.
Labels: 12-13px, regular or medium weight, NOT all-caps.

### Layout principles

- **Generous whitespace** — fewer elements, more breathing room. If a screen has more than one section of dense content, redesign it.
- **Less text** — every screen should be scannable in under 3 seconds. Cut subtitles in half if you can. The user already knows what the app does.
- **Rounded everything** — `rounded-2xl` (16px) for cards, `rounded-3xl` (24px) for hero cards, `rounded-full` for primary CTAs. Never sharp corners.
- **Soft shadows** — use `shadowColor` matching the surface tint (e.g. mint shadows for mint cards), `shadowOpacity: 0.15-0.3`, `shadowRadius: 16-24`. Add `elevation: 6-8` for Android.
- **Atmospheric backgrounds** — every screen has either a soft mint gradient OR a subtle decorative element (blurred circles, organic shapes) for depth. Never flat color.
- **Centered hierarchy** — headlines and primary content sit center-aligned, breathing room above and below.

### Component patterns

**Primary CTA button** — full-width, `rounded-full`, `bg-mint-500`, `py-5`, white Poppins SemiBold text 16px, soft mint glow shadow. Used for "Get Started", "Continue", "Save", etc.

**Secondary button** — `rounded-full`, `bg-white`, `border` border `border-mint-300`, mint-700 text. Used for "Skip", "Cancel", etc.

**Card** — `bg-white`, `rounded-3xl`, `p-5`, soft drop shadow. Cards float on mint backgrounds — they should feel like they're lifted off the page.

**Input field** — `rounded-2xl`, `bg-slate-50`, `border` `border-slate-100`, `px-4 py-4`, Poppins Medium 15px text, focused state `border-mint-400`. Labels above the input in slate-600 13px medium.

**Avatar / icon container** — circle (rounded-full) with white outer ring + colored inner circle, drop shadow. Sized 80-128px depending on hierarchy.

**Decorative circles** — soft white-on-mint blurred circles in the background corners, 200-280px diameter, 20-30% opacity. Adds depth without distraction.

### Mood board

A user opening any HealthOS screen should feel: *welcomed, calm, in control, like the app is on their side*. NOT: confronted by data, intimidated by athletic energy, lectured by an editorial layout, or dragged through a SaaS onboarding wizard.

When in doubt, **simpler wins**. Cut a subtitle. Remove a section header. Increase the padding. Round the corners more.

## Ask first before

- Installing new packages
- Changing `src/lib/db/schema.ts`
- Changing `app/_layout.tsx`
- Changing any file in `src/lib/ai/`
