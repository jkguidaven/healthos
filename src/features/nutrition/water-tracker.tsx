/**
 * src/features/nutrition/water-tracker.tsx
 *
 * Dedicated water intake tracker screen.
 *
 * A calm, focused mini-screen — one big number, three big quick-add
 * buttons, a custom override row, and a low-key reset affordance.
 *
 * Visual language: flat white page surface with rounded-3xl white
 * cards separated by subtle slate borders. Mint accents stay on the
 * hero number, progress bar, and primary CTA pill. Poppins-only
 * typography, generous whitespace.
 *
 * Data flows through `useWaterLog`. All mutations go through the hook
 * so the dashboard mini-stat stays in sync when the user returns.
 *
 * No StyleSheet.create, no raw SQL, no `any`. NativeWind classes only,
 * with shadow tokens inlined (NativeWind can't express shadow props).
 */

import React, { useCallback, useState } from 'react'
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useWaterLog, type WaterLogData } from './use-water-log'

// ─────────────────────────────────────────────
// Primary mint CTA glow — kept so the custom "Add" button still reads
// as a slightly elevated action against the flat card surfaces.
// ─────────────────────────────────────────────

const PILL_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 5,
} as const

// ─────────────────────────────────────────────
// Quick-add presets
// ─────────────────────────────────────────────

interface QuickAddPreset {
  ml: number
  label: string
  caption: string
  icon: string
}

const QUICK_ADD_PRESETS: readonly QuickAddPreset[] = [
  { ml: 250, label: '+ 250 mL', caption: 'Small glass', icon: '🥛' },
  { ml: 500, label: '+ 500 mL', caption: 'Large glass', icon: '💧' },
  { ml: 750, label: '+ 750 mL', caption: 'Sports bottle', icon: '🧴' },
] as const

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function WaterTrackerScreen(): React.ReactElement {
  const { data, add, setTotal } = useWaterLog()
  const [customValue, setCustomValue] = useState<string>('')

  const handleBack = useCallback((): void => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)/food')
    }
  }, [])

  const handleQuickAdd = useCallback(
    (ml: number): void => {
      void add(ml)
    },
    [add],
  )

  const handleCustomAdd = useCallback((): void => {
    const parsed = parseCustomMl(customValue)
    if (parsed === null) return
    void add(parsed)
    setCustomValue('')
    Keyboard.dismiss()
  }, [customValue, add])

  const handleReset = useCallback((): void => {
    Alert.alert(
      'Reset today?',
      "This will set today's water intake back to zero.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            void setTotal(0)
          },
        },
      ],
    )
  }, [setTotal])

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 4,
            paddingBottom: 48,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TopBar onBack={handleBack} />

          <HeroCard data={data} />

          <QuickAddGrid onAdd={handleQuickAdd} />

          <CustomAddRow
            value={customValue}
            onChangeText={setCustomValue}
            onSubmit={handleCustomAdd}
          />

          <ResetCard onReset={handleReset} />
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────

interface TopBarProps {
  onBack: () => void
}

function TopBar({ onBack }: TopBarProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between pt-2">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        className="active:opacity-70"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white">
          <Text className="font-sans-semibold text-[18px] text-mint-700">
            ←
          </Text>
        </View>
      </Pressable>

      <Text
        className="font-sans-semibold text-[18px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        Water
      </Text>

      {/* Right spacer keeps the title centered without clipping. */}
      <View className="h-10 w-10" />
    </View>
  )
}

// ─────────────────────────────────────────────
// Hero card — big number, progress bar, mL caption.
// ─────────────────────────────────────────────

interface HeroCardProps {
  data: WaterLogData
}

function HeroCard({ data }: HeroCardProps): React.ReactElement {
  const litersToday = data.todayMl / 1000
  const litersGoal = data.goalMl / 1000
  const pct = data.pctComplete

  return (
    <View className="mt-6 items-center rounded-3xl border border-slate-100 bg-white p-8">
      <Text className="font-sans-medium text-[12px] text-mint-600">
        Today
      </Text>

      <View className="mt-2 flex-row items-baseline">
        <Text
          className="font-sans-bold text-[72px] text-mint-600"
          style={{ letterSpacing: -2, lineHeight: 78 }}
        >
          {formatLiters(litersToday)}
        </Text>
        <Text className="ml-2 font-sans-semibold text-[22px] text-mint-500">
          L
        </Text>
      </View>

      <Text className="mt-1 font-sans-medium text-[15px] text-slate-500">
        {`of ${formatLiters(litersGoal)} L`}
      </Text>

      <View className="mt-6 h-3 w-full overflow-hidden rounded-full bg-mint-50">
        <View
          className="h-full rounded-full bg-mint-500"
          style={{ width: `${pct}%` }}
        />
      </View>

      <Text className="mt-3 font-sans text-[12px] text-slate-400">
        {`${formatWholeNumber(data.todayMl)} of ${formatWholeNumber(
          data.goalMl,
        )} mL`}
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Quick add grid — three big preset buttons.
// ─────────────────────────────────────────────

interface QuickAddGridProps {
  onAdd: (ml: number) => void
}

function QuickAddGrid({ onAdd }: QuickAddGridProps): React.ReactElement {
  return (
    <View className="mt-6">
      <Text className="mb-3 ml-1 font-sans-medium text-[13px] text-slate-600">
        Quick add
      </Text>
      <View className="flex-row">
        {QUICK_ADD_PRESETS.map((preset, idx) => (
          <View
            key={preset.ml}
            className={idx === 0 ? 'flex-1' : 'ml-3 flex-1'}
          >
            <QuickAddButton preset={preset} onAdd={onAdd} />
          </View>
        ))}
      </View>
    </View>
  )
}

interface QuickAddButtonProps {
  preset: QuickAddPreset
  onAdd: (ml: number) => void
}

function QuickAddButton({
  preset,
  onAdd,
}: QuickAddButtonProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${preset.ml} millilitres`}
      onPress={() => onAdd(preset.ml)}
      className="active:opacity-85"
    >
      <View className="items-center rounded-2xl border border-slate-100 bg-white px-3 py-5">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-mint-50">
          <Text className="text-[22px]">{preset.icon}</Text>
        </View>
        <Text
          className="mt-3 font-sans-semibold text-[14px] text-slate-900"
          style={{ letterSpacing: -0.2 }}
        >
          {preset.label}
        </Text>
        <Text className="mt-0.5 font-sans text-[10px] text-slate-400">
          {preset.caption}
        </Text>
      </View>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Custom add row — numeric input + mint pill.
// ─────────────────────────────────────────────

interface CustomAddRowProps {
  value: string
  onChangeText: (next: string) => void
  onSubmit: () => void
}

function CustomAddRow({
  value,
  onChangeText,
  onSubmit,
}: CustomAddRowProps): React.ReactElement {
  const parsed = parseCustomMl(value)
  const canSubmit = parsed !== null

  return (
    <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
      <Text className="font-sans-medium text-[13px] text-slate-600">
        Or add a custom amount
      </Text>

      <View className="mt-3 flex-row items-center">
        <View className="flex-1">
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            placeholder="Custom mL"
            placeholderTextColor="#8A9494"
            keyboardType="numeric"
            returnKeyType="done"
            className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 font-sans-medium text-[15px] text-slate-900"
            accessibilityLabel="Custom water amount in millilitres"
          />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="Add custom amount"
          accessibilityState={{ disabled: !canSubmit }}
          className={`ml-3 active:opacity-85 ${
            !canSubmit ? 'opacity-40' : ''
          }`}
        >
          <View
            className="items-center justify-center rounded-full bg-mint-500 px-6 py-4"
            style={canSubmit ? PILL_SHADOW : undefined}
          >
            <Text className="font-sans-semibold text-[14px] text-white">
              Add
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Reset card — low-key destructive affordance.
// ─────────────────────────────────────────────

interface ResetCardProps {
  onReset: () => void
}

function ResetCard({ onReset }: ResetCardProps): React.ReactElement {
  return (
    <View className="mt-4 flex-row items-center justify-between rounded-3xl border border-slate-100 bg-white p-5">
      <View className="flex-1 pr-3">
        <Text className="font-sans-medium text-[13px] text-slate-700">
          Made a mistake?
        </Text>
        <Text className="mt-0.5 font-sans text-[11px] text-slate-400">
          Reset today&apos;s count to zero
        </Text>
      </View>

      <Pressable
        onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel="Reset today's water count"
        hitSlop={8}
        className="active:opacity-70"
      >
        <Text className="font-sans-semibold text-[13px] text-brand-coral">
          Reset
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────

/**
 * Parse a user-entered custom mL string. Returns null if empty, not a
 * positive finite number, or absurdly large. Whitespace tolerated.
 */
function parseCustomMl(raw: string): number | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  if (n > 10_000) return null
  return Math.round(n)
}

function formatLiters(liters: number): string {
  if (!Number.isFinite(liters) || liters <= 0) return '0.0'
  return liters.toFixed(1)
}

function formatWholeNumber(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0'
  return Math.round(value).toLocaleString()
}
