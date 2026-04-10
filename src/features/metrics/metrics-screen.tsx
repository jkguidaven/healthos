/**
 * src/features/metrics/metrics-screen.tsx
 *
 * Tab 4 — Body metrics.
 *
 * The recomp dashboard. Shows the latest weight & body fat, a 30-day weight
 * trend chart, tape measurements, a plain-English recomp signal, and a
 * quick link to progress photos.
 *
 * Visual language matches the onboarding screens: mint gradient background
 * with soft decorative circles, Poppins-only typography, rounded-3xl white
 * cards with mint shadows, rounded-full pill CTAs.
 *
 * Layer 4 (screen). All data comes from `useMetrics()`; this file is pure
 * presentation with light formatting logic.
 */

import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMetrics, type MetricsData } from './use-metrics'
import { WeightChart } from './weight-chart'
import type { BodyMetric } from '@db/schema'

// ─────────────────────────────────────────────
// Shared shadow tokens — keep visual weight consistent across cards.
// ─────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.12,
  shadowRadius: 20,
  elevation: 6,
} as const

const SOFT_CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 3,
} as const

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
    // The body-fat modal is the closest existing logging surface. When the
    // dedicated check-in modal ships (#TODO) the route below will change.
    router.push('/(tabs)/body/body-fat')
  }

  const handleExpandTrend = (): void => {
    // Full 90-day trend screen hasn't been built yet.
    console.log('expand trend')
  }

  const handleOpenPhotos = (): void => {
    // Progress photos screen hasn't been built yet.
    console.log('photos')
  }

  return (
    <View className="flex-1 bg-mint-100">
      {/* Mint gradient background — same language as the onboarding stack. */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles for atmospheric depth */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -90, right: -110 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 220, height: 220, top: 220, left: -90 }}
      />

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
          <TopBar onLogToday={handleLogToday} />

          {/* === WEIGHT + BODY FAT TILES === */}
          <View className="mt-6 flex-row gap-3">
            <WeightTile data={data} />
            <BodyFatTile data={data} />
          </View>

          {/* === 30-DAY WEIGHT TREND === */}
          <View
            className="mt-3 rounded-3xl bg-white p-5"
            style={CARD_SHADOW}
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-semibold text-[14px] text-slate-600">
                30-day trend
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
            <View
              className="flex-row items-center justify-between rounded-3xl bg-white p-5"
              style={CARD_SHADOW}
            >
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
}

function TopBar({ onLogToday }: TopBarProps): React.ReactElement {
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
    <View
      className="flex-1 rounded-3xl bg-white p-5"
      style={CARD_SHADOW}
    >
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
// Body fat tile
// ─────────────────────────────────────────────

function BodyFatTile({ data }: TileProps): React.ReactElement {
  const bodyFat = data.latest?.bodyFatPct ?? null
  const delta = data.bodyFatDeltaMonth

  return (
    <View
      className="flex-1 rounded-3xl bg-white p-5"
      style={CARD_SHADOW}
    >
      <Text className="font-sans-medium text-[12px] text-slate-500">
        Body fat
      </Text>
      <View className="mt-1.5 flex-row items-baseline">
        <Text
          className="font-sans-bold text-[32px] text-slate-900"
          style={{ letterSpacing: -0.5 }}
        >
          {bodyFat !== null ? bodyFat.toFixed(1) : '—'}
        </Text>
        {bodyFat !== null ? (
          <Text className="ml-1.5 font-sans-medium text-[14px] text-slate-600">
            %
          </Text>
        ) : null}
      </View>
      <DeltaRow delta={delta} unit="%" period="this month" inverse={false} />
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
    <View
      className="mt-3 rounded-3xl bg-white p-5"
      style={CARD_SHADOW}
    >
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
  const message =
    !loading && data.recompSignal
      ? data.recompSignal.message
      : 'Log a weigh-in and a tape measurement to see your recomp signal.'

  return (
    <View
      className="mt-3 rounded-3xl bg-mint-50 p-5"
      style={SOFT_CARD_SHADOW}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-mint-100">
          <Text className="text-[14px]">✓</Text>
        </View>
        <Text className="font-sans-semibold text-[13px] text-mint-700">
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
