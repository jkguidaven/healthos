/**
 * src/features/coach/coach-screen.tsx
 *
 * Tab 5 — AI coach.
 *
 * The user's daily coaching surface. Reads today's coach_entry from
 * SQLite (cached) on mount; if absent, the hook silently calls Gemini
 * via `callCoach()` and saves the result. The user can force a refresh
 * with the "Regenerate digest" link when the cached entry is older than
 * a day (we treat "stale" as anything not generated today).
 *
 * Visual language: flat white page with rounded-3xl cards, mint accents
 * everywhere except the weekly summary hero (soft purple to match the
 * dashboard preview tile) and three insight cards with semantic dots:
 * mint = win, amber = watch, purple = next action. Generous whitespace,
 * Poppins-only typography.
 *
 * Layer 4 (screen). All data flows through `useCoach()`; this file is
 * pure presentation with light formatting helpers at the bottom.
 */

import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ApiKeyBanner } from '@components/ui/api-key-banner'
import { useCoach } from './use-coach'
import type { CoachResult } from '@/lib/ai/prompts/coach'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Color tokens (kept inline so the file is self-describing)
// ─────────────────────────────────────────────

const MOOD_PILL: Record<
  CoachResult['mood'],
  { label: string; bg: string; text: string }
> = {
  great: { label: 'On a roll', bg: 'bg-mint-100', text: 'text-mint-700' },
  good: { label: 'On track', bg: 'bg-mint-50', text: 'text-mint-700' },
  check_in: {
    label: 'Worth a check-in',
    bg: 'bg-amber-100',
    text: 'text-brand-amber',
  },
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function CoachScreen(): React.ReactElement {
  const { entry, loading, generating, error, needsProfile, regenerate } =
    useCoach()
  const profile = useProfileStore((s) => s.profile)

  const handleRegenerate = (): void => {
    void regenerate()
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="mt-4 flex-row items-end justify-between">
            <View>
              <Text className="font-sans text-[12px] text-slate-400">
                Personalised by Gemini
              </Text>
              <Text
                className="mt-1 font-sans-bold text-[28px] text-slate-900"
                style={{ letterSpacing: -0.5, lineHeight: 32 }}
              >
                AI coach
              </Text>
            </View>
            <Text className="font-sans-medium text-[12px] text-slate-400">
              {formatHeaderDate(new Date())}
            </Text>
          </View>

          {/* Inline API key banner — self-renders nothing if the key is fine.
              Sits between the header and the body so it's the first thing the
              user sees when an auth error needs attention. */}
          <View className="mt-5">
            <ApiKeyBanner />
          </View>

          {/* Body */}
          {needsProfile ? (
            <EmptyState
              title="Finish onboarding to unlock coaching"
              body="Once your profile is set up, your daily insights will appear here."
            />
          ) : loading ? (
            <LoadingState />
          ) : entry ? (
            <CoachContent
              entry={entry}
              generating={generating}
              onRegenerate={handleRegenerate}
            />
          ) : generating ? (
            <GeneratingState />
          ) : error ? (
            <ErrorState
              message={error.message}
              onRetry={handleRegenerate}
              retrying={generating}
            />
          ) : (
            <EmptyState
              title="Start logging food and workouts to unlock coaching"
              body="Once we have a day or two of data, your coach will have something specific to say."
              action={{
                label: generating ? 'Generating…' : 'Generate now',
                onPress: handleRegenerate,
                disabled: generating,
              }}
            />
          )}

          {/* Footnote — only when an entry exists, so the footer doesn't
              shadow empty/loading states. */}
          {entry && profile ? (
            <Text className="mt-6 text-center font-sans text-[11px] text-slate-400">
              Based on your last 7 days of food, workouts and body metrics.
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Content (entry present)
// ─────────────────────────────────────────────

interface CoachContentProps {
  entry: CoachResult
  generating: boolean
  onRegenerate: () => void
}

function CoachContent({
  entry,
  generating,
  onRegenerate,
}: CoachContentProps): React.ReactElement {
  const mood = MOOD_PILL[entry.mood]

  return (
    <View>
      {/* Hero / weekly summary card */}
      <View className="mt-6 overflow-hidden rounded-3xl bg-purple-50 p-7">
        <View className="flex-row items-center justify-between">
          <Text
            className="font-sans-semibold text-[11px] text-purple-600"
            style={{ letterSpacing: 0.4 }}
          >
            TODAY’S COACHING
          </Text>
          <View className={`rounded-full px-3 py-1 ${mood.bg}`}>
            <Text
              className={`font-sans-semibold text-[10px] ${mood.text}`}
              style={{ letterSpacing: 0.3 }}
            >
              {mood.label.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text
          className="mt-4 font-sans-semibold text-[18px] text-purple-700"
          style={{ lineHeight: 26, letterSpacing: -0.2 }}
        >
          {entry.message}
        </Text>

        {entry.weekly_highlight ? (
          <View className="mt-5 rounded-2xl bg-white/60 px-4 py-3">
            <Text
              className="font-sans-semibold text-[10px] text-purple-600"
              style={{ letterSpacing: 0.4 }}
            >
              WEEKLY HIGHLIGHT
            </Text>
            <Text
              className="mt-1 font-sans-medium text-[13px] text-purple-700"
              style={{ lineHeight: 19 }}
            >
              {entry.weekly_highlight}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Insights */}
      {entry.insights.length > 0 ? (
        <View className="mt-4">
          <SectionLabel>What the data shows</SectionLabel>
          <View className="mt-3 gap-2.5">
            {entry.insights.map((insight, i) => (
              <InsightCard
                key={`insight-${i}`}
                accent={INSIGHT_ACCENTS[i % INSIGHT_ACCENTS.length]}
                body={insight}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/* Action items */}
      {entry.action_items.length > 0 ? (
        <View className="mt-6">
          <SectionLabel>Try this next</SectionLabel>
          <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-5">
            {entry.action_items.map((item, i) => (
              <View
                key={`action-${i}`}
                className={`flex-row items-start gap-3 ${
                  i > 0 ? 'mt-4 border-t border-slate-100 pt-4' : ''
                }`}
              >
                <View className="mt-1 h-6 w-6 items-center justify-center rounded-full bg-purple-100">
                  <Text className="font-sans-semibold text-[11px] text-purple-700">
                    {i + 1}
                  </Text>
                </View>
                <Text
                  className="flex-1 font-sans text-[14px] text-slate-700"
                  style={{ lineHeight: 20 }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Regenerate */}
      <Pressable
        onPress={onRegenerate}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel="Regenerate today's coaching"
        hitSlop={8}
        className={`mt-6 self-center ${generating ? 'opacity-60' : 'active:opacity-60'}`}
      >
        <Text className="font-sans-medium text-[12px] text-purple-600">
          {generating ? 'Regenerating…' : 'Regenerate today’s coaching'}
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Section label — small all-caps tracking label, used as a soft divider
// ─────────────────────────────────────────────

interface SectionLabelProps {
  children: React.ReactNode
}

function SectionLabel({ children }: SectionLabelProps): React.ReactElement {
  return (
    <Text
      className="font-sans-semibold text-[11px] text-slate-400"
      style={{ letterSpacing: 0.6 }}
    >
      {String(children).toUpperCase()}
    </Text>
  )
}

// ─────────────────────────────────────────────
// Insight card — coloured dot + body text
// ─────────────────────────────────────────────

type InsightAccent = 'mint' | 'amber' | 'purple'
const INSIGHT_ACCENTS: InsightAccent[] = ['mint', 'amber', 'purple']

const ACCENT_DOT: Record<InsightAccent, string> = {
  mint: 'bg-mint-500',
  amber: 'bg-brand-amber',
  purple: 'bg-purple-500',
}

interface InsightCardProps {
  accent: InsightAccent
  body: string
}

function InsightCard({ accent, body }: InsightCardProps): React.ReactElement {
  return (
    <View className="flex-row items-start gap-3 rounded-3xl border border-slate-100 bg-white p-5">
      <View className={`mt-1.5 h-2.5 w-2.5 rounded-full ${ACCENT_DOT[accent]}`} />
      <Text
        className="flex-1 font-sans text-[14px] text-slate-700"
        style={{ lineHeight: 20 }}
      >
        {body}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Loading / generating / error / empty states
// ─────────────────────────────────────────────

function LoadingState(): React.ReactElement {
  return (
    <View className="mt-12 items-center">
      <ActivityIndicator color="#534AB7" />
      <Text className="mt-3 font-sans text-[13px] text-slate-500">
        Loading today’s coaching…
      </Text>
    </View>
  )
}

function GeneratingState(): React.ReactElement {
  return (
    <View className="mt-6 rounded-3xl bg-purple-50 p-7">
      <View className="flex-row items-center gap-3">
        <ActivityIndicator color="#534AB7" />
        <Text className="font-sans-semibold text-[13px] text-purple-700">
          Reading your last 7 days…
        </Text>
      </View>
      <Text
        className="mt-3 font-sans text-[12px] text-purple-600"
        style={{ lineHeight: 18 }}
      >
        Gemini is reviewing your nutrition, workouts, and body metrics to put
        together today’s coaching note. This usually takes a few seconds.
      </Text>
    </View>
  )
}

interface ErrorStateProps {
  message: string
  onRetry: () => void
  retrying: boolean
}

function ErrorState({
  message,
  onRetry,
  retrying,
}: ErrorStateProps): React.ReactElement {
  return (
    <View className="mt-6 rounded-3xl border border-slate-100 bg-white p-6">
      <Text className="font-sans-semibold text-[14px] text-brand-coral">
        Couldn’t generate coaching
      </Text>
      <Text
        className="mt-2 font-sans text-[13px] text-slate-600"
        style={{ lineHeight: 19 }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel="Retry coach generation"
        hitSlop={8}
        className={`mt-4 self-start ${retrying ? 'opacity-60' : 'active:opacity-60'}`}
      >
        <Text className="font-sans-medium text-[13px] text-purple-600">
          {retrying ? 'Retrying…' : 'Try again'}
        </Text>
      </Pressable>
    </View>
  )
}

interface EmptyStateProps {
  title: string
  body: string
  action?: { label: string; onPress: () => void; disabled?: boolean }
}

function EmptyState({
  title,
  body,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <View className="mt-12 items-center px-4">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-purple-50">
        <Text className="font-sans-bold text-[20px] text-purple-600">★</Text>
      </View>
      <Text
        className="mt-4 text-center font-sans-bold text-[20px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        {title}
      </Text>
      <Text
        className="mt-2 max-w-[280px] text-center font-sans text-[14px] text-slate-500"
        style={{ lineHeight: 20 }}
      >
        {body}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          disabled={action.disabled}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
          className={`mt-5 rounded-full px-5 py-3 ${
            action.disabled ? 'bg-purple-200' : 'bg-purple-500 active:opacity-80'
          }`}
        >
          <Text className="font-sans-semibold text-[13px] text-white">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatHeaderDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default CoachScreen
