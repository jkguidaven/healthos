# HealthOS

A personal AI-powered health companion for body recomposition. Tracks nutrition, training, and body metrics in one app, with AI-generated workout plans, photo-based food logging, and a daily coach. Local-first, open-source, and bring-your-own Gemini API key — no servers, no signup, no monthly fee.

Built with React Native + Expo + TypeScript. Runs on iOS and Android (and a limited web build).

## What it does

- **Nutrition** — log meals by photo (Gemini vision), barcode (Open Food Facts), or manual entry. Tracks calories, macros, and water against personalised targets.
- **Training** — AI generates a periodised workout plan from your split, days/week, equipment, and experience level. Session logger tracks sets, reps, and progressive overload.
- **Body metrics** — body fat (Navy + FFMI), BMI, BMR, TDEE, weight trend, progress photos, and tape measurements.
- **AI coach** — daily check-ins that synthesise food, training, and body data into one short, recomp-aware nudge.
- **Privacy** — every byte lives in SQLite on-device. The only network calls are to Gemini (for AI features), Open Food Facts (barcode lookup), and WGER (exercise library).

## Why this exists (and why it might not be for you)

### Pros

- **Local-first.** Your health data never leaves your device except for the AI calls you trigger. No accounts, no cloud sync, no analytics.
- **No subscription.** You bring a free Gemini API key. The free tier (1500 requests/day, 15 RPM) covers personal use comfortably.
- **Recomp-tuned by default.** Macros default to high-protein, the coach understands surplus-on-training-days, and progress is framed as trends — not daily pass/fail on the scale.
- **Open-source and forkable.** Plain TypeScript, no proprietary services, well-tested formulas. Fork it, tweak the prompts, ship your own version.
- **Cross-platform.** One codebase runs on iOS and Android via Expo.
- **AI features that actually work.** Photo food scanning, plan generation, and coaching are first-class — not bolted-on chat widgets.

### Cons

- **No cloud sync.** Switch phones and you lose your history unless you export first (Settings → Export). This is a deliberate trade-off, not an oversight.
- **Bring-your-own API key.** You have to create a Gemini key on the Google AI Studio page during onboarding. It's free and takes a minute, but it's an extra step.
- **Free tier has limits.** Heavy users (lots of photo scans + plan regenerations + coaching in one day) can hit Gemini's free quota.
- **Personal project.** Built for one user (me), shared because it might be useful to you. There is no support contract, no SLA, no roadmap commitment, and bugs may take a while to fix.
- **Web is limited.** The web build runs but several native APIs (camera, secure storage, notifications) are stubbed or fall back. iOS and Android are the supported targets.
- **Recomp-first defaults.** If you're doing a hard cut or aggressive bulk, the macro defaults and coach tone won't match. You can override targets, but the opinionated copy is recomp-leaning.
- **Not medical advice.** Formulas (BMR, TDEE, body fat estimates) are well-known approximations. Treat them as directional, not diagnostic.

## Quick start

### Prerequisites

- **Node.js 20+** and **pnpm 10+**
- **Xcode** (iOS simulator) or **Android Studio** (Android emulator), or a physical device with the **Expo Go** app
- A free **Google Gemini API key** — you'll paste this into the app on first launch ([get one here](https://aistudio.google.com/app/apikey))

### Run the app

```bash
pnpm install
pnpm ios       # iOS simulator
pnpm android   # Android emulator
pnpm start     # Metro bundler — scan the QR with Expo Go on device
```

On first launch the app walks you through onboarding (profile → goal → API key) and then drops you on the dashboard.

### Common scripts

```bash
pnpm test           # Jest unit + component tests
pnpm lint           # ESLint
pnpm type-check     # tsc --noEmit
pnpm db:generate    # Drizzle migration after schema changes
pnpm db:migrate     # Apply migrations
```

When adding or upgrading any Expo / React Native package, use `npx expo install <pkg>` instead of `pnpm add` so the version aligns with the installed Expo SDK.

## Project layout

```
app/                    Expo Router routes (thin re-exports, no logic)
src/features/           One folder per feature (nutrition, workout, metrics, coach, ...)
src/lib/ai/             Gemini client + prompt files + Zod schemas
src/lib/db/             Drizzle schema + migrations + query helpers
src/lib/formulas/       Pure TypeScript health math (body fat, TDEE, macros)
src/components/         Shared UI
docs/                   Architecture, UX wireframes, AI prompts, decisions
.claude/agents/         Claude Code subagent definitions
```

## Documentation

Deeper docs live in [`docs/`](./docs):

- [`docs/project-guide.md`](./docs/project-guide.md) — full architecture, tech stack, design decisions, build phases
- [`docs/ux-wireframes.md`](./docs/ux-wireframes.md) — every screen with layout specs and states
- [`docs/ai-prompts.md`](./docs/ai-prompts.md) — exact Gemini system prompts and Zod response schemas
- [`docs/api-key-flow.md`](./docs/api-key-flow.md) — Gemini key lifecycle (SecureStore, onboarding, settings)
- [`docs/subagents.md`](./docs/subagents.md) — Claude Code subagent definitions
- [`docs/decisions/`](./docs/decisions) — architecture decision records (ADRs)

If you're working on the codebase with Claude Code, [`CLAUDE.md`](./CLAUDE.md) at the repo root holds the rules and guardrails the agent reads first.

## License

MIT.
