/**
 * src/features/nutrition/nutrition-screen.tsx
 *
 * Tab 2 — Food log.
 *
 * Daily list of food entries grouped by meal, with a big "scan food" CTA
 * at the top and a today summary card.
 *
 * Visual language mirrors the dashboard and body screens: soft 3-stop
 * mint gradient background, decorative blurred circles, rounded-3xl
 * white cards with mint shadows, Poppins-only typography, generous
 * whitespace. Intent: welcoming, scannable, calm.
 *
 * Data comes from `useFoodLog`. This file is pure presentation + light
 * formatting. No StyleSheet.create, no raw SQL, no `any`.
 */

import React, { useCallback } from 'react'
import { Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MacroBar } from '@components/ui/macro-bar'
import type { FoodLogEntry } from '@db/schema'
import {
  useFoodLog,
  type NutritionByMeal,
  type NutritionData,
} from './use-food-log'
import { useWaterLog, type WaterLogData } from './use-water-log'

// ─────────────────────────────────────────────
// Shared shadow tokens — tuned to the mint surface so cards feel lifted.
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
// Meal configuration — stable order for the section loop.
// ─────────────────────────────────────────────

type MealKey = keyof NutritionByMeal

interface MealConfig {
  key: MealKey
  label: string
}

const MEAL_ORDER: readonly MealConfig[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
] as const

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function NutritionScreen(): React.ReactElement {
  const { data, deleteEntry } = useFoodLog()
  const { data: waterData } = useWaterLog()

  const handleOpenScan = useCallback((): void => {
    router.push('/(tabs)/food/scan')
  }, [])

  const handleOpenManual = useCallback((): void => {
    router.push('/(tabs)/food/manual')
  }, [])

  const handleOpenWater = useCallback((): void => {
    router.push('/(tabs)/food/water')
  }, [])

  const handleEditEntry = useCallback((entry: FoodLogEntry): void => {
    // Full edit modal is a future feature.
    // eslint-disable-next-line no-console
    console.log('edit', entry.id)
  }, [])

  const handleDeleteEntry = useCallback(
    (entry: FoodLogEntry): void => {
      Alert.alert(
        'Delete this entry?',
        `${entry.name} will be removed from today's log.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteEntry(entry.id)
            },
          },
        ],
      )
    },
    [deleteEntry],
  )

  return (
    <View className="flex-1 bg-mint-100">
      {/* Atmospheric mint gradient — same 3-stop palette as welcome / dashboard. */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles. */}
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
        style={{ width: 180, height: 180, bottom: 60, right: -60 }}
      />

      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          <TopBar onAddManual={handleOpenManual} />

          <ScanCtaCard onPress={handleOpenScan} />

          <TodaySummaryCard data={data} />

          <WaterShortcutCard data={waterData} onPress={handleOpenWater} />

          <FoodLogList
            byMeal={data.byMeal}
            onEdit={handleEditEntry}
            onLongPress={handleDeleteEntry}
          />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Top bar — centered title + manual-entry pill.
// ─────────────────────────────────────────────

interface TopBarProps {
  onAddManual: () => void
}

function TopBar({ onAddManual }: TopBarProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <View>
        <Text
          className="font-sans-bold text-[28px] text-slate-900"
          style={{ letterSpacing: -0.5 }}
        >
          Food
        </Text>
        <Text className="mt-0.5 font-sans text-[13px] text-slate-500">
          Today&apos;s log
        </Text>
      </View>

      <Pressable
        onPress={onAddManual}
        accessibilityRole="button"
        accessibilityLabel="Add manual entry"
        className="active:opacity-90"
      >
        <View
          className="flex-row items-center gap-1.5 rounded-full bg-white px-4 py-2.5"
          style={SOFT_CARD_SHADOW}
        >
          <Text className="font-sans-semibold text-[13px] text-mint-600">
            +
          </Text>
          <Text className="font-sans-semibold text-[12px] text-mint-700">
            Add manual
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Big scan CTA card
// ─────────────────────────────────────────────

interface ScanCtaCardProps {
  onPress: () => void
}

function ScanCtaCard({ onPress }: ScanCtaCardProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Scan food photo or barcode"
      className="mt-6 active:opacity-90"
    >
      <View
        className="flex-row items-center rounded-3xl bg-white p-5"
        style={HERO_CARD_SHADOW}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-mint-100"
          style={PILL_SHADOW}
        >
          <Text className="text-[18px]">📷</Text>
        </View>

        <View className="ml-4 flex-1">
          <Text
            className="font-sans-semibold text-[16px] text-slate-900"
            style={{ letterSpacing: -0.2 }}
          >
            Scan food photo
          </Text>
          <Text className="mt-0.5 font-sans text-[12px] text-slate-500">
            or scan a barcode
          </Text>
        </View>

        <Text className="font-sans-semibold text-[20px] text-mint-600">→</Text>
      </View>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Today summary card
// ─────────────────────────────────────────────

interface TodaySummaryCardProps {
  data: NutritionData
}

function TodaySummaryCard({
  data,
}: TodaySummaryCardProps): React.ReactElement {
  const { summary, goalCalories, goalProteinG, entries } = data
  const hasAnyEntry = entries.length > 0
  const dateLabel = formatTodayLabel(new Date())

  return (
    <View className="mt-4 rounded-3xl bg-white p-5" style={CARD_SHADOW}>
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-[14px] text-slate-600">
          Today&apos;s totals
        </Text>
        <Text className="font-sans text-[12px] text-slate-400">
          {dateLabel}
        </Text>
      </View>

      <View className="mt-5 flex-row">
        <SummaryMetric
          label="Calories"
          value={formatNumber(summary.calories)}
          goalText={`of ${formatNumber(goalCalories)} kcal`}
          tone="slate"
        />
        <View className="w-4" />
        <SummaryMetric
          label="Protein"
          value={`${formatNumber(summary.proteinG)}g`}
          goalText={`of ${formatNumber(goalProteinG)}g`}
          tone="mint"
        />
      </View>

      <View className="mt-5">
        <MacroBar
          proteinG={summary.proteinG}
          carbsG={summary.carbsG}
          fatG={summary.fatG}
          height={12}
        />
      </View>

      {!hasAnyEntry ? (
        <View className="mt-5 rounded-2xl bg-mint-50 px-4 py-3">
          <Text
            className="font-sans text-[12px] text-mint-700"
            style={{ lineHeight: 18 }}
          >
            No entries yet — tap the camera card above to log your first meal.
          </Text>
        </View>
      ) : null}
    </View>
  )
}

interface SummaryMetricProps {
  label: string
  value: string
  goalText: string
  tone: 'slate' | 'mint'
}

function SummaryMetric({
  label,
  value,
  goalText,
  tone,
}: SummaryMetricProps): React.ReactElement {
  const valueColor = tone === 'mint' ? 'text-mint-600' : 'text-slate-900'

  return (
    <View className="flex-1">
      <Text className="font-sans text-[12px] text-slate-500">{label}</Text>
      <Text
        className={`mt-1 font-sans-bold text-[28px] ${valueColor}`}
        style={{ letterSpacing: -0.6 }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 font-sans text-[12px] text-slate-400">
        {goalText}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Water shortcut card — compact tappable row that routes to the
// dedicated water tracker screen. Shows today's progress inline so
// the user can glance at hydration without leaving the food tab.
// ─────────────────────────────────────────────

interface WaterShortcutCardProps {
  data: WaterLogData
  onPress: () => void
}

function WaterShortcutCard({
  data,
  onPress,
}: WaterShortcutCardProps): React.ReactElement {
  const litersToday = (data.todayMl / 1000).toFixed(1)
  const litersGoal = (data.goalMl / 1000).toFixed(1)
  const pct = data.pctComplete

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open water tracker"
      className="mt-4 active:opacity-90"
    >
      <View
        className="flex-row items-center rounded-3xl bg-white p-5"
        style={CARD_SHADOW}
      >
        <View
          className="h-11 w-11 items-center justify-center rounded-full bg-mint-50"
          style={SOFT_CARD_SHADOW}
        >
          <Text className="text-[18px]">💧</Text>
        </View>

        <View className="ml-4 flex-1">
          <Text
            className="font-sans-semibold text-[14px] text-slate-900"
            style={{ letterSpacing: -0.2 }}
          >
            Water
          </Text>
          <Text className="mt-0.5 font-sans text-[12px] text-slate-500">
            {`${litersToday} of ${litersGoal} L today`}
          </Text>

          <View className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-mint-50">
            <View
              className="h-full rounded-full bg-mint-500"
              style={{ width: `${pct}%` }}
            />
          </View>
        </View>

        <Text className="ml-3 font-sans-semibold text-[20px] text-mint-600">
          →
        </Text>
      </View>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Food log list — meal sections + entry cards.
// ─────────────────────────────────────────────

interface FoodLogListProps {
  byMeal: NutritionByMeal
  onEdit: (entry: FoodLogEntry) => void
  onLongPress: (entry: FoodLogEntry) => void
}

function FoodLogList({
  byMeal,
  onEdit,
  onLongPress,
}: FoodLogListProps): React.ReactElement {
  return (
    <View className="mt-6">
      {MEAL_ORDER.map(({ key, label }) => {
        const entries = byMeal[key]
        const mealCalories = entries.reduce(
          (sum, entry) => sum + entry.calories,
          0,
        )
        return (
          <MealSection
            key={key}
            label={label}
            totalKcal={mealCalories}
            entries={entries}
            onEdit={onEdit}
            onLongPress={onLongPress}
          />
        )
      })}
    </View>
  )
}

interface MealSectionProps {
  label: string
  totalKcal: number
  entries: FoodLogEntry[]
  onEdit: (entry: FoodLogEntry) => void
  onLongPress: (entry: FoodLogEntry) => void
}

function MealSection({
  label,
  totalKcal,
  entries,
  onEdit,
  onLongPress,
}: MealSectionProps): React.ReactElement {
  const isEmpty = entries.length === 0

  return (
    <View className="mb-5">
      <View className="mb-2.5 flex-row items-baseline justify-between px-1">
        <Text className="font-sans-semibold text-[14px] text-slate-700">
          {label}
        </Text>
        {isEmpty ? null : (
          <Text className="font-sans text-[12px] text-slate-500">
            {`${formatNumber(totalKcal)} kcal`}
          </Text>
        )}
      </View>

      {isEmpty ? (
        <View className="items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 p-4">
          <Text className="font-sans text-[12px] italic text-slate-400">
            Nothing logged yet
          </Text>
        </View>
      ) : (
        <View>
          {entries.map((entry, idx) => (
            <View key={entry.id} className={idx > 0 ? 'mt-2.5' : ''}>
              <FoodEntryCard
                entry={entry}
                onPress={() => onEdit(entry)}
                onLongPress={() => onLongPress(entry)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────
// Food entry card — one row per logged item.
// ─────────────────────────────────────────────

interface FoodEntryCardProps {
  entry: FoodLogEntry
  onPress: () => void
  onLongPress: () => void
}

function FoodEntryCard({
  entry,
  onPress,
  onLongPress,
}: FoodEntryCardProps): React.ReactElement {
  const macrosLine = `P ${formatGrams(entry.proteinG)}g · C ${formatGrams(
    entry.carbsG,
  )}g · F ${formatGrams(entry.fatG)}g`

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Edit ${entry.name}`}
      className="active:opacity-90"
    >
      <View
        className="flex-row items-center rounded-2xl bg-white p-4"
        style={SOFT_CARD_SHADOW}
      >
        <View className="flex-1 pr-3">
          <Text
            className="font-sans-semibold text-[14px] text-slate-900"
            numberOfLines={1}
          >
            {entry.name}
          </Text>
          <Text className="mt-0.5 font-sans text-[11px] text-slate-500">
            {macrosLine}
          </Text>

          <EntryBadge entry={entry} />
        </View>

        <View className="items-end">
          <Text
            className="font-sans-bold text-[16px] text-slate-900"
            style={{ letterSpacing: -0.3 }}
          >
            {formatNumber(entry.calories)}
          </Text>
          <Text className="font-sans text-[9px] text-slate-400">kcal</Text>
        </View>
      </View>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Inline confidence / source badge.
//
// The shared `ConfidenceBadge` component uses a larger style than we
// want in the dense food-log row; we inline a tighter version here so
// the list stays calm.
// ─────────────────────────────────────────────

interface EntryBadgeProps {
  entry: FoodLogEntry
}

function EntryBadge({ entry }: EntryBadgeProps): React.ReactElement | null {
  if (entry.source === 'manual') {
    return null
  }

  let dotClass = 'bg-brand-green'
  let textClass = 'text-brand-green'
  let label = 'AI scan · high'

  if (entry.source === 'barcode') {
    dotClass = 'bg-brand-blue'
    textClass = 'text-brand-blue'
    label = 'Barcode'
  } else if (entry.source === 'ai_scan') {
    if (entry.confidence === 'medium') {
      dotClass = 'bg-brand-amber'
      textClass = 'text-brand-amber'
      label = 'AI scan · medium'
    } else if (entry.confidence === 'low') {
      dotClass = 'bg-brand-coral'
      textClass = 'text-brand-coral'
      label = 'AI scan · low'
    }
  }

  return (
    <View className="mt-1.5 flex-row items-center">
      <View className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      <Text className={`ml-1.5 font-sans-medium text-[9px] ${textClass}`}>
        {label}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Small pure formatting helpers.
// ─────────────────────────────────────────────

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString()
}

function formatGrams(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toString()
}

function formatTodayLabel(date: Date): string {
  // e.g. "Sun, Apr 12"
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
}
