/**
 * src/features/nutrition/plate-coach-card.tsx
 *
 * "Today's plate" coaching card rendered on the Food tab under the
 * Today summary. The card is driven by `usePlateCoach()` — a pure-TS
 * rule engine, zero AI calls. See `@/lib/formulas/plate-coach.ts`.
 *
 * The card has two modes:
 *   - Collapsed: a compact mint pill, used when all targets are hit.
 *   - Expanded: full card with headline, one-line detail, and optional
 *     recent-food suggestions ranked by protein density.
 *
 * Visual language matches the rest of the Food tab — rounded-3xl cards,
 * slate borders, Poppins-only, mint accents. Tone drives the leading
 * dot + pill colour so the user can read state at a glance.
 */

import React from 'react'
import { Text, View } from 'react-native'

import type {
  PlateCoachOutput,
  PlateCoachSuggestion,
  PlateCoachTone,
} from '@/lib/formulas/plate-coach'

interface PlateCoachCardProps {
  coach: PlateCoachOutput
}

export function PlateCoachCard({
  coach,
}: PlateCoachCardProps): React.ReactElement {
  if (coach.collapsed) {
    return <CollapsedPill headline={coach.headline} tone={coach.tone} />
  }
  return <ExpandedCard coach={coach} />
}

// ─────────────────────────────────────────────
// Collapsed — compact compliment pill
// ─────────────────────────────────────────────

interface CollapsedPillProps {
  headline: string
  tone: PlateCoachTone
}

function CollapsedPill({
  headline,
  tone,
}: CollapsedPillProps): React.ReactElement {
  const dot = toneDotColour(tone)
  return (
    <View className="mt-4 flex-row items-center rounded-full border border-mint-200 bg-mint-50 px-4 py-3">
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: dot }}
      />
      <Text
        className="ml-2.5 flex-1 font-sans-medium text-[13px] text-mint-700"
        numberOfLines={2}
      >
        {headline}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Expanded — full card
// ─────────────────────────────────────────────

interface ExpandedCardProps {
  coach: PlateCoachOutput
}

function ExpandedCard({
  coach,
}: ExpandedCardProps): React.ReactElement {
  const { accent, label } = toneBadge(coach.tone)
  return (
    <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-[14px] text-slate-600">
          Today&apos;s plate
        </Text>
        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: accent.bg }}
        >
          <Text
            className="font-sans-semibold text-[10px] uppercase"
            style={{ color: accent.fg, letterSpacing: 0.4 }}
          >
            {label}
          </Text>
        </View>
      </View>

      <Text
        className="mt-4 font-sans-bold text-[18px] text-slate-900"
        style={{ letterSpacing: -0.3, lineHeight: 24 }}
      >
        {coach.headline}
      </Text>

      <Text
        className="mt-2 font-sans text-[13px] text-slate-600"
        style={{ lineHeight: 19 }}
      >
        {coach.detail}
      </Text>

      {coach.suggestions.length > 0 ? (
        <View className="mt-4 gap-2">
          {coach.suggestions.map((s) => (
            <SuggestionRow key={s.name} suggestion={s} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

interface SuggestionRowProps {
  suggestion: PlateCoachSuggestion
}

function SuggestionRow({
  suggestion,
}: SuggestionRowProps): React.ReactElement {
  return (
    <View className="flex-row items-center rounded-2xl bg-slate-50 px-3.5 py-3">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-mint-100">
        <Text className="font-sans-bold text-[13px] text-mint-700">
          {suggestion.proteinG}g
        </Text>
      </View>
      <View className="ml-3 flex-1">
        <Text
          className="font-sans-semibold text-[13px] text-slate-900"
          numberOfLines={1}
        >
          {suggestion.name}
        </Text>
        <Text
          className="mt-0.5 font-sans text-[11px] text-slate-500"
          numberOfLines={1}
        >
          {suggestion.reason}
        </Text>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Tone styling
// ─────────────────────────────────────────────

interface ToneBadge {
  accent: { bg: string; fg: string }
  label: string
}

function toneBadge(tone: PlateCoachTone): ToneBadge {
  switch (tone) {
    case 'ahead':
      return {
        accent: { bg: '#E6F6EF', fg: '#0F7A55' },
        label: 'Dialled in',
      }
    case 'on-track':
      return {
        accent: { bg: '#EEF2FF', fg: '#3946A3' },
        label: 'On track',
      }
    case 'behind':
      return {
        accent: { bg: '#FFF4E5', fg: '#A45B00' },
        label: 'Needs protein',
      }
    case 'over':
      return {
        accent: { bg: '#FFECEC', fg: '#A62C2C' },
        label: 'Over today',
      }
    case 'empty':
    default:
      return {
        accent: { bg: '#F1F5F9', fg: '#475569' },
        label: 'Today\u2019s plate',
      }
  }
}

function toneDotColour(tone: PlateCoachTone): string {
  switch (tone) {
    case 'ahead':
      return '#2BBF9E'
    case 'on-track':
      return '#5B6BD9'
    case 'behind':
      return '#D98A2B'
    case 'over':
      return '#D94B4B'
    case 'empty':
    default:
      return '#94A3B8'
  }
}
