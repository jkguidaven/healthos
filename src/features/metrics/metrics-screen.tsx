/**
 * src/features/metrics/metrics-screen.tsx
 *
 * Tab 4 — Body metrics.
 *
 * The recomp dashboard. Shows the latest weight & body fat, a 30-day weight
 * trend chart, tape measurements, a plain-English recomp signal, and a
 * quick link to progress photos.
 *
 * Visual language: flat white page with rounded-3xl white cards
 * separated by subtle slate borders. Mint accents on pills, badges, and
 * the "Log today" CTA. Poppins-only typography, generous whitespace.
 *
 * Layer 4 (screen). All data comes from `useMetrics()`; this file is pure
 * presentation with light formatting logic.
 */

import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useMetrics, type MetricsData } from './use-metrics'
import { WeightChart } from './weight-chart'
import type { BodyMetric } from '@db/schema'
import {
  BODY_FAT_CATEGORY_LABEL,
  getBodyFatCategory,
  type BodyFatCategory,
} from '@formulas/body-fat'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Shared shadow tokens — the primary "Log today" pill keeps a soft mint
// glow so the main CTA still feels slightly elevated.
// ─────────────────────────────────────────────

const PILL_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.25,
  shadowRadius: 12,
  elevation: 5,
} as const

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function MetricsScreen(): React.ReactElement {
  const { data, loading } = useMetrics()

  const handleLogToday = (): void => {
    // The /body/body-fat route is the daily check-in screen — name is
    // legacy from when it was a body-fat-only calculator.
    router.push('/(tabs)/body/body-fat')
  }

  const handleEdit = (): void => {
    router.push('/(tabs)/body/edit')
  }

  const handleExpandTrend = (): void => {
    // Full 90-day trend screen hasn't been built yet.
    console.log('expand trend')
  }

  const handleOpenPhotos = (): void => {
    // Progress photos screen hasn't been built yet.
    console.log('photos')
  }

  // Show a dedicated empty state when the user has zero body_metric
  // entries — the dashed metric tiles aren't a great first impression
  // and the recomp signal card is meaningless without data.
  const hasNoEntries = !loading && data.entryCount === 0

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
          {/* === TOP BAR === */}
          <TopBar onLogToday={handleLogToday} onEdit={handleEdit} />

          {hasNoEntries ? (
            <BodyMetricsEmptyState onLogToday={handleLogToday} />
          ) : null}

          {/* === WEIGHT + WAIST TILES (the trustworthy hero metrics) === */}
          <View className="mt-6 flex-row gap-3">
            <WeightTile data={data} />
            <WaistTile data={data} />
          </View>

          {/* === BODY FAT ESTIMATE CARD (with caveat + trend) === */}
          <BodyFatEstimateCard data={data} />

          {/* === 30-DAY WEIGHT TREND === */}
          <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-[14px] text-slate-600">
                30-day weight trend
              </Text>
              <Pressable
                onPress={handleExpandTrend}
                accessibilityRole="button"
                accessibilityLabel="Expand trend"
                hitSlop={8}
                className="active:opacity-60"
              >
                <Text className="font-sans-medium text-[12px] text-mint-600">
                  expand →
                </Text>
              </Pressable>
            </View>
            <WeightChart points={data.thirtyDayTrend} />
          </View>

          {/* === MEASUREMENTS === */}
          <MeasurementsCard latest={data.latest} />

          {/* === RECOMP SIGNAL === */}
          <RecompSignalCard data={data} loading={loading} />

          {/* === PROGRESS PHOTOS LINK === */}
          <Pressable
            onPress={handleOpenPhotos}
            accessibilityRole="button"
            accessibilityLabel="Open progress photos"
            className="mt-3 active:opacity-90"
          >
            <View className="flex-row items-center justify-between rounded-3xl border border-slate-100 bg-white p-5">
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-mint-100">
                  <Text className="text-[16px]">📷</Text>
                </View>
                <Text className="font-sans-semibold text-[14px] text-slate-900">
                  Progress photos
                </Text>
              </View>
              <Text className="font-sans-medium text-[18px] text-mint-600">
                ›
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────

interface TopBarProps {
  onLogToday: () => void
  onEdit: () => void
}

function TopBar({ onLogToday, onEdit }: TopBarProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <View>
        <Text
          className="font-sans-bold text-[28px] text-slate-900"
          style={{ letterSpacing: -0.5 }}
        >
          Body
        </Text>
        <Text className="mt-0.5 font-sans text-[13px] text-slate-500">
          Your recomp dashboard
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          accessibilityLabel="Edit measurements"
          className="active:opacity-80"
        >
          <View className="flex-row items-center gap-1 rounded-full border border-slate-100 bg-white px-3 py-2.5">
            <Ionicons name="create-outline" size={14} color="#475569" />
            <Text className="font-sans-semibold text-[12px] text-slate-600">
              Edit
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onLogToday}
          accessibilityRole="button"
          accessibilityLabel="Log today"
          className="active:opacity-90"
        >
          <View
            className="flex-row items-center gap-1.5 rounded-full bg-mint-500 px-4 py-2.5"
            style={PILL_SHADOW}
          >
            <Text className="font-sans-semibold text-[13px] text-white">+</Text>
            <Text className="font-sans-semibold text-[12px] text-white">
              Log today
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Empty state — shown when the user has zero body_metric entries.
// Sits above the metric tiles so it's the first thing they see.
// ─────────────────────────────────────────────

interface BodyMetricsEmptyStateProps {
  onLogToday: () => void
}

function BodyMetricsEmptyState({
  onLogToday,
}: BodyMetricsEmptyStateProps): React.ReactElement {
  return (
    <View className="mt-6 items-center rounded-3xl bg-mint-50 px-6 py-9">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
        <Text className="text-[28px]">{'\u2696\uFE0F'}</Text>
      </View>
      <Text
        className="mt-4 text-center font-sans-bold text-[20px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        Log your first weigh-in
      </Text>
      <Text className="mt-2 max-w-[280px] text-center font-sans text-[13px] text-slate-600">
        Track weight, waist, and body fat over time so the recomp signal
        knows what to compare against.
      </Text>
      <Pressable
        onPress={onLogToday}
        accessibilityRole="button"
        accessibilityLabel="Log your first weigh-in"
        hitSlop={6}
        className="mt-5 rounded-full bg-mint-500 px-6 py-3 active:opacity-80"
        style={PILL_SHADOW}
      >
        <Text className="font-sans-semibold text-[14px] text-white">
          Log today
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Weight tile
// ─────────────────────────────────────────────

interface TileProps {
  data: MetricsData
}

function WeightTile({ data }: TileProps): React.ReactElement {
  const weight = data.latest?.weightKg ?? null
  const delta = data.weightDeltaWeek

  return (
    <View className="flex-1 rounded-3xl border border-slate-100 bg-white p-5">
      <Text className="font-sans-medium text-[12px] text-slate-500">
        Weight
      </Text>
      <View className="mt-1.5 flex-row items-baseline">
        <Text
          className="font-sans-bold text-[32px] text-slate-900"
          style={{ letterSpacing: -0.5 }}
        >
          {weight !== null ? weight.toFixed(1) : '—'}
        </Text>
        {weight !== null ? (
          <Text className="ml-1.5 font-sans-medium text-[14px] text-slate-600">
            kg
          </Text>
        ) : null}
      </View>
      <DeltaRow delta={delta} unit="kg" period="this week" inverse={false} />
    </View>
  )
}

// ─────────────────────────────────────────────
// Waist tile — promoted to a hero metric because for a recomp user it's
// a more trustworthy fat-loss signal than calculated body fat % (the
// Navy formula is famously inflated for muscular people).
// ─────────────────────────────────────────────

function WaistTile({ data }: TileProps): React.ReactElement {
  const waist = data.latest?.waistCm ?? null
  const delta = data.waistDeltaMonth

  return (
    <View className="flex-1 rounded-3xl border border-slate-100 bg-white p-5">
      <Text className="font-sans-medium text-[12px] text-slate-500">
        Waist
      </Text>
      <View className="mt-1.5 flex-row items-baseline">
        <Text
          className="font-sans-bold text-[32px] text-slate-900"
          style={{ letterSpacing: -0.5 }}
        >
          {waist !== null ? waist.toFixed(1) : '—'}
        </Text>
        {waist !== null ? (
          <Text className="ml-1.5 font-sans-medium text-[14px] text-slate-600">
            cm
          </Text>
        ) : null}
      </View>
      <DeltaRow delta={delta} unit="cm" period="this month" inverse={false} />
    </View>
  )
}

// ─────────────────────────────────────────────
// Body fat estimate card — full width.
// Shown below the Weight + Waist hero row. Body fat is a calculated
// estimate (not a measurement), and the Navy formula systematically
// over-estimates body fat for muscular people, so the card communicates
// the uncertainty explicitly:
//   - Big number with a small "estimate" badge
//   - 30-day trend chart (delta matters more than absolute)
//   - "How accurate is this?" expandable explanation
// ─────────────────────────────────────────────

/**
 * Map a body fat fitness category to a tone palette. Athletic + Fitness
 * read as "you're crushing it" (mint), Average is neutral (slate), and
 * Above average gets a soft amber so it's noticed without feeling like
 * a scolding red alert.
 */
function bodyFatCategoryTone(category: BodyFatCategory): {
  bg: string
  border: string
  text: string
} {
  switch (category) {
    case 'essential':
      return {
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        text: 'text-blue-700',
      }
    case 'athletic':
    case 'fitness':
      return {
        bg: 'bg-mint-50',
        border: 'border-mint-100',
        text: 'text-mint-700',
      }
    case 'average':
      return {
        bg: 'bg-slate-50',
        border: 'border-slate-100',
        text: 'text-slate-600',
      }
    case 'obese':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        text: 'text-amber-800',
      }
  }
}

function BodyFatEstimateCard({ data }: TileProps): React.ReactElement {
  const [showDetails, setShowDetails] = React.useState(false)
  const sex = useProfileStore((s) => s.profile?.sex ?? null)
  const bodyFat = data.latest?.bodyFatPct ?? null
  const delta = data.bodyFatDeltaMonth

  // Derive the fitness category from the latest body fat reading + sex.
  const category =
    bodyFat !== null && sex !== null ? getBodyFatCategory(sex, bodyFat) : null

  return (
    <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="font-sans-semibold text-[14px] text-slate-600">
              Body fat
            </Text>
            <View className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5">
              <Text className="font-sans-medium text-[9px] tracking-wider text-slate-500">
                ESTIMATE
              </Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-baseline">
            <Text
              className="font-sans-bold text-[40px] text-slate-900"
              style={{ letterSpacing: -1 }}
            >
              {bodyFat !== null ? bodyFat.toFixed(1) : '—'}
            </Text>
            {bodyFat !== null ? (
              <Text className="ml-1.5 font-sans-medium text-[14px] text-slate-600">
                %
              </Text>
            ) : null}
          </View>
          <DeltaRow
            delta={delta}
            unit="%"
            period="this month"
            inverse={false}
          />
        </View>

        {/* Fitness category pill — Athletic / Fitness / Average / Above average */}
        {category ? (
          <View
            className={`rounded-full border px-3 py-1 ${bodyFatCategoryTone(category).bg} ${bodyFatCategoryTone(category).border}`}
          >
            <Text
              className={`font-sans-semibold text-[11px] ${bodyFatCategoryTone(category).text}`}
            >
              {BODY_FAT_CATEGORY_LABEL[category]}
            </Text>
          </View>
        ) : null}
      </View>

      {/* 30-day body fat trend — emphasises the delta over the absolute. */}
      {data.thirtyDayTrend.length >= 2 ? (
        <View className="mt-4">
          <Text className="font-sans text-[11px] text-slate-400">
            30-day trend
          </Text>
          <WeightChart
            points={data.thirtyDayTrend}
            selector={(p) => p.bodyFatPct}
            height={96}
            emptyLabel="Log a few body-fat readings to see the trend"
          />
        </View>
      ) : null}

      {/* Caveat / accuracy explainer */}
      <Pressable
        onPress={() => setShowDetails((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="How accurate is this?"
        hitSlop={8}
        className="mt-4 active:opacity-70"
      >
        <View className="flex-row items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5">
          <Ionicons name="information-circle" size={14} color="#64748B" />
          <Text className="flex-1 font-sans-medium text-[11px] text-slate-600">
            How accurate is this?
          </Text>
          <Ionicons
            name={showDetails ? 'chevron-up' : 'chevron-down'}
            size={12}
            color="#94A3B8"
          />
        </View>
      </Pressable>

      {showDetails ? (
        <View className="mt-2 rounded-2xl border border-slate-100 bg-white p-4">
          <Text
            className="font-sans text-[11px] text-slate-600"
            style={{ lineHeight: 16 }}
          >
            This number comes from the US Navy formula (waist, neck, height
            for men; + hip for women). For an average person it&apos;s within
            ±3-4%. For lifters it&apos;s often 3-6 percentage points high
            because squat-developed obliques and back muscle inflate your
            waist measurement without adding fat.
            {'\n\n'}
            <Text className="font-sans-semibold">Trust the trend, not the absolute number.</Text>
            {' '}If your reading drops 2 points over a month, you really
            did lose ~2 percentage points — even if the starting number
            was off.
            {'\n\n'}
            For a more accurate read: a DEXA scan ($150-300) or skin
            calipers from a trained measurer. For day-to-day recomp
            tracking, your waist circumference and progress photos are
            more honest.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Delta row — coloured dot + text
// ─────────────────────────────────────────────

interface DeltaRowProps {
  delta: number | null
  unit: string
  period: string
  /** When true, "up" is green (e.g. arm circumference). Default: "down" is green. */
  inverse: boolean
}

function DeltaRow({
  delta,
  unit,
  period,
  inverse,
}: DeltaRowProps): React.ReactElement {
  if (delta === null) {
    return (
      <View className="mt-3 flex-row items-center gap-2">
        <View className="h-1.5 w-1.5 rounded-full bg-slate-200" />
        <Text className="font-sans text-[11px] text-slate-400">
          No entry yet
        </Text>
      </View>
    )
  }

  const sign = delta === 0 ? '·' : delta < 0 ? '↓' : '↑'
  const magnitude = Math.abs(delta).toFixed(1)
  const isGood = inverse ? delta > 0 : delta <= 0
  // For recomp context, "down or flat" reads as progress on weight / waist.
  const toneClass = isGood ? 'text-mint-600' : 'text-slate-500'
  const dotClass = isGood ? 'bg-mint-500' : 'bg-slate-300'

  return (
    <View className="mt-3 flex-row items-center gap-2">
      <View className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <Text className={`font-sans-medium text-[11px] ${toneClass}`}>
        {`${sign} ${magnitude} ${unit} ${period}`}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Measurements card
// ─────────────────────────────────────────────

interface MeasurementsCardProps {
  latest: BodyMetric | null
}

function MeasurementsCard({
  latest,
}: MeasurementsCardProps): React.ReactElement {
  const waist = latest?.waistCm ?? null
  const hip = latest?.hipCm ?? null
  const arm = latest?.armCm ?? null
  const chest = latest?.chestCm ?? null
  const thigh = latest?.thighCm ?? null

  const hasSecondRow = chest !== null || thigh !== null

  return (
    <View className="mt-3 rounded-3xl border border-slate-100 bg-white p-5">
      <View className="flex-row items-baseline">
        <Text className="font-sans-semibold text-[14px] text-slate-600">
          Measurements
        </Text>
        <Text className="ml-1.5 font-sans text-[11px] text-slate-400">
          (cm)
        </Text>
      </View>

      <View className="mt-4 flex-row gap-3">
        <MeasurementCell label="Waist" value={waist} />
        <MeasurementCell label="Hip" value={hip} />
        <MeasurementCell label="Arm" value={arm} />
      </View>

      {hasSecondRow ? (
        <View className="mt-3 flex-row gap-3">
          <MeasurementCell label="Chest" value={chest} />
          <MeasurementCell label="Thigh" value={thigh} />
          {/* Invisible spacer keeps the 3-column rhythm aligned. */}
          <View className="flex-1" />
        </View>
      ) : null}
    </View>
  )
}

interface MeasurementCellProps {
  label: string
  value: number | null
}

function MeasurementCell({
  label,
  value,
}: MeasurementCellProps): React.ReactElement {
  return (
    <View className="flex-1 rounded-2xl bg-slate-50 px-3 py-3">
      <Text className="font-sans text-[11px] text-slate-500">{label}</Text>
      <Text
        className="mt-1 font-sans-bold text-[22px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        {value !== null ? value.toFixed(1) : '—'}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Recomp signal card
// ─────────────────────────────────────────────

interface RecompSignalCardProps {
  data: MetricsData
  loading: boolean
}

function RecompSignalCard({
  data,
  loading,
}: RecompSignalCardProps): React.ReactElement {
  // Three honest states:
  //   - Computed signal → show it.
  //   - 1 entry → "we'll start computing once you log a second check-in".
  //   - 0 entries → "log your first check-in".
  // The original copy ("log a weigh-in and a tape measurement") implied
  // a single log was enough — it isn't, the signal needs comparative data
  // over time, so the empty states now make that explicit.
  const message = !loading && data.recompSignal
    ? data.recompSignal.message
    : data.entryCount === 0
    ? 'Log your first check-in to start tracking your recomp signal.'
    : data.entryCount === 1
    ? 'Nice — first entry logged. We’ll start computing your recomp signal once you log a second check-in.'
    : 'Not enough variation yet — keep logging and your recomp signal will sharpen.'

  // Per the wireframes (Tab 4 §5) the recomp signal lives on an amber
  // surface so it stands out from the surrounding mint cards as the
  // "interpret what the numbers mean" callout, not just another data tile.
  return (
    <View className="mt-3 rounded-3xl border border-amber-100 bg-amber-50 p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-amber-100">
          <Ionicons name="sparkles" size={14} color="#C77416" />
        </View>
        <Text className="font-sans-semibold text-[13px] text-brand-amber">
          Recomp signal
        </Text>
      </View>
      <Text
        className="mt-3 font-sans text-[14px] text-slate-700"
        style={{ lineHeight: 20 }}
      >
        {message}
      </Text>
    </View>
  )
}
