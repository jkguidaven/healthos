/**
 * src/lib/ai/prompts/coach-chat.ts
 *
 * Conversational coach. Hybrid context strategy:
 *   - A tiny "always-on" snapshot (today's macros, latest weight, active
 *     plan week, week workouts) is injected into the system prompt so
 *     simple questions don't need a tool call.
 *   - Historical / drill-down data is fetched via function-calling tools
 *     in `src/lib/ai/tools/coach-tools.ts`.
 *
 * Sliding window: the caller sends only the last N turns of chat history.
 *
 * Scope guard: the system prompt restricts the model to nutrition,
 * training, body composition, sleep, recovery, and the user's logged
 * data. Off-topic questions get a short polite refusal.
 */

import { and, desc, eq, gte, isNotNull } from 'drizzle-orm'
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite'

import {
  bodyMetricTable,
  foodLogTable,
  profileTable,
  sessionTable,
  workoutPlanTable,
} from '@db/schema'
import type * as schema from '@db/schema'

import { callAIChat, type ChatTurn } from '../ai-client'
import { COACH_TOOLS, runCoachTool } from '../tools/coach-tools'

type DB = ExpoSQLiteDatabase<typeof schema>

// ─────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────

const SCOPE = `You are the HealthOS coach — a conversational body-recomposition assistant.

SCOPE — you ONLY answer questions about:
- The user's logged data (food, workouts, weight, body measurements, progress)
- Nutrition, macros, protein, calories
- Training, exercise form, programming, progressive overload
- Body composition, recomposition, cutting, bulking
- Recovery, sleep as it relates to training, and hydration
- Goal-setting and habit advice tied to the app's scope

If a question falls OUTSIDE this scope (general knowledge, coding, trivia, medical diagnosis, current events, unrelated topics), reply briefly and politely:
"That's outside what I can help with here — I'm your health & fitness coach. Ask me anything about your training, nutrition, or progress."
Then stop. Do NOT attempt to answer the off-topic question.

BEHAVIOUR:
- Direct, encouraging, evidence-based. Not cheerleader-generic. Not harsh.
- Reference the user's actual data whenever relevant — never invent numbers.
- If you need historical data (specific days, weight history, workout details), call a tool. The "always-on" snapshot below is a summary, not the full record.
- Keep replies concise: 1–4 short paragraphs. Use bullet points only when listing ≥3 items.
- Never recommend medications, specific medical procedures, or diagnose conditions. Suggest a clinician for medical concerns.

RECOMPOSITION UNDERSTANDING:
- Recomp is slow. Scale weight fluctuates ±1–2kg from glycogen/water — don't treat a bad week as failure.
- Protein is the #1 variable. Progressive overload is the #1 training driver.
- The real recomp signals are: waist shrinking, strength climbing, body fat % dropping over 4+ weeks.`

export function buildCoachChatSystemPrompt(snapshot: string): string {
  return `${SCOPE}\n\n=== ALWAYS-ON SNAPSHOT ===\n${snapshot}\n=== END SNAPSHOT ===\n\nWhen the snapshot has what you need, answer directly. Otherwise call a tool.`
}

// ─────────────────────────────────────────────
// Snapshot builder — cheap always-on context.
// Aim for <200 tokens of text.
// ─────────────────────────────────────────────

export async function buildCoachSnapshot(
  db: DB,
  profileId: number,
): Promise<string> {
  const todayIso = new Date().toISOString().split('T')[0]
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 6)
  const weekAgoIso = weekAgo.toISOString().split('T')[0]

  const [profile] = await db
    .select()
    .from(profileTable)
    .where(eq(profileTable.id, profileId))
    .limit(1)

  const todayFood = await db
    .select()
    .from(foodLogTable)
    .where(
      and(
        eq(foodLogTable.profileId, profileId),
        eq(foodLogTable.date, todayIso),
      ),
    )

  const [latestBody] = await db
    .select()
    .from(bodyMetricTable)
    .where(eq(bodyMetricTable.profileId, profileId))
    .orderBy(desc(bodyMetricTable.date))
    .limit(1)

  const weekSessions = await db
    .select({ id: sessionTable.id, date: sessionTable.date, name: sessionTable.name })
    .from(sessionTable)
    .where(
      and(
        eq(sessionTable.profileId, profileId),
        gte(sessionTable.date, weekAgoIso),
        isNotNull(sessionTable.completedAt),
      ),
    )
    .orderBy(desc(sessionTable.date))

  const [activePlan] = await db
    .select()
    .from(workoutPlanTable)
    .where(
      and(
        eq(workoutPlanTable.profileId, profileId),
        eq(workoutPlanTable.isActive, true),
      ),
    )
    .orderBy(desc(workoutPlanTable.createdAt))
    .limit(1)

  const lines: string[] = []
  lines.push(`Today: ${todayIso}`)

  if (profile) {
    lines.push(
      `Profile: ${profile.sex} ${profile.age}yo, ${profile.weightKg}kg, goal=${profile.goal}`,
      `Daily targets: ${profile.goalCalories}kcal / P${profile.goalProteinG}g C${profile.goalCarbsG}g F${profile.goalFatG}g`,
    )
  }

  if (todayFood.length > 0) {
    const totals = todayFood.reduce(
      (a, r) => ({
        cal: a.cal + r.calories,
        p: a.p + r.proteinG,
        c: a.c + r.carbsG,
        f: a.f + r.fatG,
      }),
      { cal: 0, p: 0, c: 0, f: 0 },
    )
    lines.push(
      `Today logged: ${totals.cal}kcal / P${totals.p.toFixed(0)}g C${totals.c.toFixed(0)}g F${totals.f.toFixed(0)}g across ${todayFood.length} entries`,
    )
  } else {
    lines.push('Today logged: nothing yet')
  }

  if (latestBody) {
    lines.push(
      `Latest body metric (${latestBody.date}): ${latestBody.weightKg}kg` +
        (latestBody.waistCm !== null ? `, waist ${latestBody.waistCm}cm` : '') +
        (latestBody.bodyFatPct !== null ? `, bf ${latestBody.bodyFatPct}%` : ''),
    )
  } else {
    lines.push('Body metrics: none logged')
  }

  if (activePlan) {
    lines.push(
      `Active plan: "${activePlan.name}" (${activePlan.daysPerWeek}x/week, ${activePlan.splitType})`,
    )
  }
  lines.push(
    `Workouts in last 7 days: ${weekSessions.length}${
      weekSessions[0] ? ` (most recent: ${weekSessions[0].name} on ${weekSessions[0].date})` : ''
    }`,
  )

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// Tool loop runner
// ─────────────────────────────────────────────

const MAX_TOOL_ITERATIONS = 5
const CHAT_MAX_TOKENS = 1024

export interface SendCoachMessageParams {
  db: DB
  profileId: number
  /** Prior turns to include as context (sliding window). Oldest first. */
  history: { role: 'user' | 'assistant'; text: string }[]
  /** The new user message. */
  userMessage: string
}

/**
 * Run a single user turn through Gemini, handling any tool calls
 * transparently and returning the final assistant text.
 */
export async function sendCoachMessage(
  params: SendCoachMessageParams,
): Promise<string> {
  const snapshot = await buildCoachSnapshot(params.db, params.profileId)
  const system = buildCoachChatSystemPrompt(snapshot)

  const turns: ChatTurn[] = [
    ...params.history.map(
      (m): ChatTurn =>
        m.role === 'user'
          ? { role: 'user', text: m.text }
          : { role: 'assistant', text: m.text },
    ),
    { role: 'user', text: params.userMessage },
  ]

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
    const result = await callAIChat({
      system,
      turns,
      tools: COACH_TOOLS,
      maxTokens: CHAT_MAX_TOKENS,
    })
    if (result.kind === 'text') {
      return result.text
    }
    // Tool call — record the assistant's call, run it, append response, loop.
    turns.push({
      role: 'assistant',
      functionCall: { name: result.name, args: result.args },
    })
    const toolResponse = await runCoachTool(
      params.db,
      params.profileId,
      result.name,
      result.args,
    )
    turns.push({ role: 'tool', name: result.name, response: toolResponse })
  }
  throw new Error('Coach chat exceeded max tool iterations')
}
