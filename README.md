# HealthOS — project documentation

> Drop this entire folder into your repo before you start building.
> Everything an AI agent needs to build this app correctly is in here.

## File index

### Agent operating guides
| File | Purpose | Where it lives in repo |
|---|---|---|
| `CLAUDE.md` | Root agent guide — read-first rules, project map, hard constraints | `/CLAUDE.md` (also copy as `/AGENTS.md`) |

### Architecture docs
| File | Purpose | Where it lives in repo |
|---|---|---|
| `HEALTHOS_PROJECT_GUIDE.md` | Full architecture, tech stack, design decisions, build phases | `docs/HEALTHOS_PROJECT_GUIDE.md` |
| `HEALTHOS_UX_WIREFRAMES.md` | All 16 screens — layout specs, component patterns, states | `docs/HEALTHOS_UX_WIREFRAMES.md` |
| `ai-prompts.md` | Exact Gemini system prompts, context shapes, Zod schemas | `docs/ai-prompts.md` |
| `api-key-flow.md` | API key lifecycle — SecureStore, onboarding, settings, boot | `docs/api-key-flow.md` |

### Reference code
| File | Purpose | Where it lives in repo |
|---|---|---|
| `schema.ts` | Complete Drizzle schema — all 11 tables with types | `src/lib/db/schema.ts` |
| `canonical-feature-example.ts` | Full body fat feature — all 4 layers to copy | `docs/canonical-feature-example.ts` |
| `infrastructure.ts` | `ai-client.ts`, `api-key.ts`, test utils, CI, PR template | Split — see file header comments |

### Subagents
| File | Purpose | Where it lives in repo |
|---|---|---|
| `subagents.md` | 3 Claude Code subagent definitions | Split into `.claude/agents/*.md` |

### Architecture Decision Records
| File | Decision |
|---|---|
| `decisions/001-local-first.md` | Why no backend |
| `decisions/002-drizzle-over-raw-sql.md` | Why Drizzle ORM |
| `decisions/003-claude-api-model.md` | Why Gemini (gemini-2.5-flash) is the AI provider |
| `decisions/004-in-app-api-key.md` | Why SecureStore instead of .env |

## How to use when building

When starting a Claude Code session on this project, reference docs contextually:

```
# Starting a new screen
"Build the food log screen. Read docs/HEALTHOS_UX_WIREFRAMES.md#tab-2--food-log and CLAUDE.md first."

# Writing a database query
"Add a query to get the last 7 days of food logs. Read src/lib/db/schema.ts first."

# Changing a prompt
"Update the coach prompt to include water intake data. Read docs/ai-prompts.md#3-daily-coaching-prompt first, then run pnpm prompt:test coach."

# Building a new feature
"Build the water logging feature. Read docs/canonical-feature-example.ts for the pattern to follow."
```
