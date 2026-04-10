/**
 * src/features/workout/workout-screen.tsx
 *
 * Tab 3 — Workout (pre-session view).
 *
 * Shows the user's currently active plan: summary card with rationale,
 * an 8-week progress strip, and a list of day cards with their exercises.
 * Each day card gets a "Begin" CTA that will eventually kick off the
 * session logger (#48); for now it no-ops with a debug log.
 *
 * When no active plan exists, the screen falls back to a friendly empty
 * state with a single "Generate your first plan" action. Both states
 * route into `/(tabs)/workout/generate` — owned by a parallel agent (#45).
 *
 * Visual language matches the rest of the app: mint gradient background
 * with soft decorative circles, Poppins-only typography, rounded-3xl
 * white cards with mint shadows, rounded-full pill CTAs.
 *
 * Layer 4 (screen). All data comes from `useWorkoutPlanView()`; this
 * file is pure presentation with small formatting helpers.
 */

import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@components/ui/button'
import {
  useWorkoutPlanView,
  type PlanDayWithExercises,
  type WorkoutPlanViewData,
} from './use-workout-plan-view'
import type { Session, WorkoutPlan } from '@db/schema'

// ─────────────────────────────────────────────
// Shared shadow tokens — tuned for mint-on-mint cards. Inlined here so
// the screen reads as one self-contained visual module.
// ─────────────────────────────────────────────

const HERO_CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.15,
  shadowRadius: 24,
  elevation: 8,
} as const

const CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 5,
} as const

const SOFT_CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
} as const

const MINT_PILL_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
  elevation: 5,
} as const

// Hardcoded "current week" — week-level progress tracking lands with #49.
// Keeping the constant here (not the hook) so the visual default is easy
// to swap once that feature arrives.
const CURRENT_WEEK = 1

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function WorkoutScreen(): React.ReactElement {
  const { data, loading } = useWorkoutPlanView()

  const handleGenerate = (): void => {
    router.push('/(tabs)/workout/generate')
  }

  const hasPlan = data.plan != null

  return (
    <View className="flex-1 bg-mint-100">
      {/* Atmospheric mint gradient — same 3-stop as every other tab. */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles for depth. */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -90, right: -110 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 220, height: 220, top: 260, left: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/15"
        style={{ width: 180, height: 180, bottom: 40, right: -60 }}
      />

      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 48,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          <TopBar hasPlan={hasPlan} onGenerate={handleGenerate} />

          {loading && !hasPlan ? (
            <LoadingState />
          ) : !hasPlan ? (
            <EmptyState onGenerate={handleGenerate} />
          ) : (
            <PlanView data={data} onGenerate={handleGenerate} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Top bar — title + contextual "generate plan" pill.
// When there's no plan, the pill is nearly hidden (the empty state's
// primary CTA does the heavy lifting). When a plan exists, the pill
// offers a subtle "swap" affordance in the corner.
// ─────────────────────────────────────────────

interface TopBarProps {
  hasPlan: boolean
  onGenerate: () => void
}

function TopBar({ hasPlan, onGenerate }: TopBarProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between">
      <Text
        className="font-sans-bold text-[28px] text-slate-900"
        style={{ letterSpacing: -0.5 }}
      >
        Training
      </Text>

      {hasPlan ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Generate a new plan"
          onPress={onGenerate}
          hitSlop={8}
          className="active:opacity-70"
        >
          <View
            className="rounded-full bg-white px-4 py-2"
            style={SOFT_CARD_SHADOW}
          >
            <Text className="font-sans-medium text-[12px] text-slate-600">
              New plan
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Loading state — minimal dot while SQLite reads settle.
// ─────────────────────────────────────────────

function LoadingState(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center pt-40">
      <View
        className="h-14 w-14 items-center justify-center rounded-full bg-white"
        style={SOFT_CARD_SHADOW}
      >
        <View className="h-6 w-6 rounded-full bg-mint-300" />
      </View>
      <Text className="mt-4 font-sans text-[13px] text-slate-500">
        Loading your plan…
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Empty state — no active plan. Pushes slightly above center so the
// hero card doesn't sit awkwardly low on tall phones.
// ─────────────────────────────────────────────

interface EmptyStateProps {
  onGenerate: () => void
}

function EmptyState({ onGenerate }: EmptyStateProps): React.ReactElement {
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ paddingBottom: 80 }}
    >
      <View
        className="w-full items-center rounded-3xl bg-white p-7"
        style={HERO_CARD_SHADOW}
      >
        <View
          className="h-20 w-20 items-center justify-center rounded-full bg-mint-100"
          style={SOFT_CARD_SHADOW}
        >
          <Text className="text-[36px]">{'\u{1F4AA}'}</Text>
        </View>

        <Text
          className="mt-5 text-center font-sans-bold text-[22px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          No plan yet
        </Text>

        <Text
          className="mt-3 text-center font-sans text-[14px] text-slate-600"
          style={{ lineHeight: 20, maxWidth: 280 }}
        >
          Generate a personalised plan tailored to your goal, equipment, and
          schedule.
        </Text>

        <View className="mt-6 w-full">
          <Button onPress={onGenerate}>Generate your first plan</Button>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Plan view — summary card, week strip, day cards, footer link.
// ─────────────────────────────────────────────

interface PlanViewProps {
  data: WorkoutPlanViewData
  onGenerate: () => void
}

function PlanView({ data, onGenerate }: PlanViewProps): React.ReactElement {
  const { plan, days } = data
  // `data.plan` is narrowed to non-null by the caller, but we re-check
  // locally so the type flows through without a non-null assertion.
  if (plan == null) return <View />

  const handleBeginDay = (dayId: number): void => {
    router.push({
      pathname: '/(tabs)/workout/session',
      params: { planId: String(plan.id), dayId: String(dayId) },
    })
  }

  return (
    <View className="mt-6">
      <PlanSummaryCard plan={plan} />

      <View className="mt-4">
        <WeekProgressStrip
          weeksTotal={plan.weeksTotal}
          currentWeek={CURRENT_WEEK}
        />
      </View>

      <Text className="mb-3 mt-6 font-sans-semibold text-[14px] text-slate-700">
        This week
      </Text>

      <View>
        {days.map((day, idx) => (
          <View
            key={day.day.id}
            style={idx > 0 ? { marginTop: 12 } : undefined}
          >
            <DayCard
              day={day}
              onBegin={handleBeginDay}
              isDoneThisWeek={data.recentlyCompletedDayIds.has(day.day.id)}
            />
          </View>
        ))}
      </View>

      {data.recentSessions.length > 0 ? (
        <RecentSessionsSection sessions={data.recentSessions} days={days} />
      ) : null}

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Generate a new plan"
        onPress={onGenerate}
        hitSlop={10}
        className="mt-8 items-center active:opacity-60"
      >
        <Text className="font-sans-medium text-[13px] text-mint-600">
          Generate a new plan {'\u2192'}
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Plan summary card — name, meta, "Active" pill, rationale.
// ─────────────────────────────────────────────

interface PlanSummaryCardProps {
  plan: WorkoutPlan
}

function PlanSummaryCard({
  plan,
}: PlanSummaryCardProps): React.ReactElement {
  const splitLabel = formatSplit(plan.splitType)
  const meta = `Week ${CURRENT_WEEK} of ${plan.weeksTotal} \u00B7 ${splitLabel} \u00B7 ${plan.daysPerWeek} days/week`

  return (
    <View className="rounded-3xl bg-white p-5" style={HERO_CARD_SHADOW}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="font-sans-semibold text-[16px] text-slate-900"
            numberOfLines={2}
          >
            {plan.name}
          </Text>
          <Text
            className="mt-1 font-sans text-[12px] text-slate-500"
            style={{ lineHeight: 16 }}
          >
            {meta}
          </Text>
        </View>

        <View
          className="rounded-full bg-mint-500 px-3 py-1"
          style={MINT_PILL_SHADOW}
        >
          <Text className="font-sans-medium text-[11px] text-white">
            Active
          </Text>
        </View>
      </View>

      {plan.rationale != null && plan.rationale.trim().length > 0 ? (
        <View className="mt-4 rounded-2xl bg-mint-50 px-4 py-3">
          <Text
            className="font-sans text-[13px] text-slate-600"
            style={{ lineHeight: 18 }}
          >
            {plan.rationale}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Week progress strip — 8 pills, filled up to currentWeek.
// ─────────────────────────────────────────────

interface WeekProgressStripProps {
  weeksTotal: number
  currentWeek: number
}

function WeekProgressStrip({
  weeksTotal,
  currentWeek,
}: WeekProgressStripProps): React.ReactElement {
  const segments = Array.from({ length: weeksTotal }, (_, i) => i + 1)

  return (
    <View>
      <View className="flex-row gap-1">
        {segments.map((weekNum) => (
          <View
            key={weekNum}
            className={`h-2 flex-1 rounded-full ${
              weekNum <= currentWeek ? 'bg-mint-500' : 'bg-mint-100'
            }`}
          />
        ))}
      </View>
      <Text className="mt-2 font-sans text-[11px] text-slate-400">
        Week {currentWeek} of {weeksTotal}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Day card — day name, muscle groups, begin pill, exercise list.
// ─────────────────────────────────────────────

// Show at most this many exercises before collapsing the rest into a
// "+N more" line. Tuned so a typical PPL day (6 lifts) stays scannable.
const DAY_CARD_EXERCISE_PREVIEW = 4

interface DayCardProps {
  day: PlanDayWithExercises
  onBegin: (dayId: number) => void
  /** True if this dayId appears in the recently-completed set. */
  isDoneThisWeek: boolean
}

function DayCard({
  day,
  onBegin,
  isDoneThisWeek,
}: DayCardProps): React.ReactElement {
  const muscleLabel = formatMuscleGroups(day.muscleGroups)
  const visibleExercises = day.exercises.slice(0, DAY_CARD_EXERCISE_PREVIEW)
  const hiddenCount = day.exercises.length - visibleExercises.length

  const handleBegin = (): void => {
    onBegin(day.day.id)
  }

  return (
    <View className="rounded-3xl bg-white p-5" style={CARD_SHADOW}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text
              className="font-sans-semibold text-[16px] text-slate-900"
              numberOfLines={1}
            >
              {day.day.dayName}
            </Text>
            {isDoneThisWeek ? (
              <View className="rounded-full bg-mint-100 px-2 py-0.5">
                <Text className="font-sans-semibold text-[10px] text-mint-700">
                  ✓ Done
                </Text>
              </View>
            ) : null}
          </View>
          {muscleLabel.length > 0 ? (
            <Text
              className="mt-1 font-sans text-[12px] text-slate-500"
              numberOfLines={1}
            >
              {muscleLabel}
            </Text>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Begin ${day.day.dayName}`}
          onPress={handleBegin}
          hitSlop={6}
          className="active:opacity-85"
        >
          <View
            className="rounded-full bg-mint-500 px-4 py-2"
            style={MINT_PILL_SHADOW}
          >
            <Text className="font-sans-semibold text-[12px] text-white">
              {isDoneThisWeek ? 'Repeat ' : 'Begin '}
              {'\u2192'}
            </Text>
          </View>
        </Pressable>
      </View>

      {visibleExercises.length > 0 ? (
        <View className="mt-4 border-t border-slate-100 pt-4">
          {visibleExercises.map((ex, idx) => (
            <View
              key={ex.id}
              className="flex-row items-center justify-between"
              style={idx > 0 ? { marginTop: 10 } : undefined}
            >
              <Text
                className="flex-1 pr-3 font-sans text-[13px] text-slate-700"
                numberOfLines={1}
              >
                {ex.name}
              </Text>
              <Text className="font-sans-medium text-[12px] text-slate-500">
                {ex.sets} {'\u00D7'} {ex.reps}
              </Text>
            </View>
          ))}

          {hiddenCount > 0 ? (
            <Text className="mt-3 font-sans text-[12px] text-slate-400">
              + {hiddenCount} more
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="mt-4 rounded-2xl bg-slate-50 px-4 py-3">
          <Text className="font-sans text-[12px] text-slate-500">
            No exercises yet for this day.
          </Text>
        </View>
      )}

      {day.day.estimatedMinutes != null ? (
        <Text className="mt-3 font-sans text-[11px] text-slate-400">
          ~{day.day.estimatedMinutes} min
        </Text>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Recent sessions — last N completed sessions, newest first.
// Renders below the days list so the user has a visible record.
// ─────────────────────────────────────────────

interface RecentSessionsSectionProps {
  sessions: Session[]
  days: PlanDayWithExercises[]
}

const MAX_RECENT_SESSIONS_VISIBLE = 5

function RecentSessionsSection({
  sessions,
  days,
}: RecentSessionsSectionProps): React.ReactElement {
  const visible = sessions.slice(0, MAX_RECENT_SESSIONS_VISIBLE)

  return (
    <View className="mt-8">
      <Text className="mb-3 font-sans-semibold text-[14px] text-slate-700">
        Recent sessions
      </Text>
      <View className="rounded-3xl bg-white p-2" style={CARD_SHADOW}>
        {visible.map((session, idx) => {
          const matchingDay = days.find((d) => d.day.id === session.dayId)
          const dayName = matchingDay?.day.dayName ?? session.name ?? 'Workout'
          return (
            <View
              key={session.id}
              className="flex-row items-center justify-between px-3 py-3"
              style={
                idx > 0
                  ? { borderTopWidth: 1, borderTopColor: '#F1F5F9' }
                  : undefined
              }
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-mint-100">
                  <Text className="font-sans-bold text-[14px] text-mint-700">
                    ✓
                  </Text>
                </View>
                <View>
                  <Text className="font-sans-semibold text-[14px] text-slate-900">
                    {dayName}
                  </Text>
                  <Text className="font-sans text-[11px] text-slate-500">
                    {formatRelativeDate(session.completedAt ?? session.date)}
                  </Text>
                </View>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return ''
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  const now = Date.now()
  const diffMs = now - ts
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.floor(diffMs / dayMs)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  const date = new Date(ts)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ─────────────────────────────────────────────
// Pure formatting helpers — kept local so the hook stays data-only.
// ─────────────────────────────────────────────

/**
 * Turn a split enum into a friendly human label.
 */
export function formatSplit(
  split: 'full_body' | 'upper_lower' | 'ppl' | 'custom',
): string {
  switch (split) {
    case 'full_body':
      return 'Full body'
    case 'upper_lower':
      return 'Upper/Lower'
    case 'ppl':
      return 'Push/Pull/Legs'
    case 'custom':
      return 'Custom'
  }
}

/**
 * Join muscle groups with a middot and capitalise each one. Returns
 * an empty string if the list is empty so the caller can hide the row.
 */
export function formatMuscleGroups(groups: string[]): string {
  if (groups.length === 0) return ''
  return groups.map(capitalise).join(' \u00B7 ')
}

function capitalise(word: string): string {
  if (word.length === 0) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}
