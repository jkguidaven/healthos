/**
 * src/features/dashboard/dashboard-screen.tsx
 *
 * Layer 4 — Home tab. The daily at-a-glance view across the four pillars:
 * nutrition, training, body, coach.
 *
 * Visual language mirrors the welcome screen and onboarding flow: mint
 * gradient background, soft decorative circles in the corners, rounded-3xl
 * white cards floating on top with mint shadows, Poppins typography, and
 * generous whitespace.
 *
 * Data is read through the `useDashboard` hook. While most of the underlying
 * food / workout / coach queries are stubbed (filled in during later build
 * phases), the screen is built to handle those empty states intentionally —
 * a zero state should feel friendly, not broken.
 *
 * No StyleSheet.create, no raw SQL, no `any`. NativeWind classes only, with
 * shadow props inlined where NativeWind can't express them.
 */

import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MacroBar } from '@components/ui/macro-bar'
import { useDashboard, type DashboardData } from './use-dashboard'

// ─────────────────────────────────────────────
// Shared shadow tokens. Inlined here (rather than pulled from a global
// styles module) so the dashboard stays self-contained and the shadow
// feels "tuned" to these cards specifically.
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

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function DashboardScreen(): React.ReactElement {
  const { data, loading } = useDashboard()

  return (
    <View className="flex-1 bg-mint-100">
      {/* Atmospheric background — same 3-stop mint gradient as welcome/onboarding. */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles — large top-right, smaller middle-left. */}
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
            paddingBottom: 40,
          }}
          showsVerticalScrollIndicator={false}
        >
          {data == null ? (
            <LoadingState loading={loading} />
          ) : !data.hasProfile ? (
            <NotSetUpState />
          ) : (
            <DashboardContent data={data} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Main content — all the cards. Split from the screen shell so empty
// states can replace it cleanly.
// ─────────────────────────────────────────────

interface DashboardContentProps {
  data: DashboardData
}

function DashboardContent({
  data,
}: DashboardContentProps): React.ReactElement {
  const caloriesPct = clampPct(data.todayCalories, data.goalCalories)
  const proteinPct = clampPct(data.todayProteinG, data.goalProteinG)

  const hasAnyFoodLogged = data.todayCalories > 0 || data.todayProteinG > 0

  return (
    <View>
      <TopBar
        greeting={data.greeting}
        profileName={data.profileName}
        dateLabel={data.todayLabel}
      />

      {/* === HERO: Calories + Protein ===================================== */}
      <View
        className="mt-6 rounded-3xl bg-white p-6"
        style={HERO_CARD_SHADOW}
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-sans-semibold text-[14px] text-slate-600">
            Today
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="View details"
            onPress={() => {
              router.push('/(tabs)/food')
            }}
            hitSlop={8}
            className="active:opacity-60"
          >
            <Text className="font-sans-medium text-[12px] text-mint-600">
              View details
            </Text>
          </Pressable>
        </View>

        <View className="mt-5 flex-row">
          <HeroMetric
            label="Calories"
            value={formatNumber(data.todayCalories)}
            unit="kcal"
            goalText={`of ${formatNumber(data.goalCalories)} kcal`}
            progressPct={caloriesPct}
            fillClass="bg-mint-500"
            valueClass="text-slate-900"
          />
          <View className="w-4" />
          <HeroMetric
            label="Protein"
            value={`${formatNumber(data.todayProteinG)}g`}
            unit=""
            goalText={`of ${formatNumber(data.goalProteinG)}g`}
            progressPct={proteinPct}
            fillClass="bg-mint-600"
            valueClass="text-mint-600"
          />
        </View>

        {!hasAnyFoodLogged ? (
          <View className="mt-5 rounded-2xl bg-mint-50 px-4 py-3">
            <Text
              className="font-sans text-[12px] text-mint-700"
              style={{ lineHeight: 18 }}
            >
              Tap the food tab to log your first meal.
            </Text>
          </View>
        ) : null}
      </View>

      {/* === MACRO BREAKDOWN ============================================== */}
      <View className="mt-4 rounded-3xl bg-white p-5" style={CARD_SHADOW}>
        <Text className="font-sans-semibold text-[13px] text-slate-600">
          Macro breakdown
        </Text>

        <View className="mt-4">
          <MacroBar
            proteinG={data.todayProteinG}
            carbsG={data.todayCarbsG}
            fatG={data.todayFatG}
            height={12}
          />
        </View>
      </View>

      {/* === AI COACH ===================================================== */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open coach"
        onPress={() => {
          router.push('/(tabs)/coach')
        }}
        className="mt-4 active:opacity-90"
      >
        <View
          className="rounded-3xl bg-mint-50 p-5"
          style={SOFT_CARD_SHADOW}
        >
          <View className="flex-row items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-mint-200">
              <View className="h-3 w-3 rounded-full bg-mint-600" />
            </View>
            <Text className="ml-3 font-sans-medium text-[12px] text-mint-700">
              Daily insight
            </Text>
          </View>
          <Text
            className="mt-3 font-sans text-[14px] text-slate-700"
            style={{ lineHeight: 20 }}
          >
            {data.coachMessage}
          </Text>
        </View>
      </Pressable>

      {/* === MINI STATS =================================================== */}
      <View className="mt-4 flex-row">
        <MiniStatCard
          label="Workouts"
          value={`${data.workoutsThisWeek}`}
          sublabel="this week"
        />
        <View className="w-3" />
        <MiniStatCard
          label="Weight"
          value={
            data.todayWeightKg != null
              ? `${formatOneDecimal(data.todayWeightKg)} kg`
              : '—'
          }
          sublabel={data.todayWeightKg != null ? 'latest' : 'no entry'}
        />
        <View className="w-3" />
        <MiniStatCard
          label="Water"
          value={`${formatLiters(data.todayWaterMl)} L`}
          sublabel={`of ${formatLiters(data.waterTarget)} L`}
          valueTone={
            data.todayWaterMl < data.waterTarget * 0.5 ? 'coral' : 'default'
          }
          onPress={() => {
            router.push('/(tabs)/food/water')
          }}
          accessibilityLabel="Open water tracker"
        />
      </View>

      {/* === TODAY'S WORKOUT CTA ========================================== */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Start today's workout"
        onPress={() => {
          // Workout tab is still a placeholder — wire up in Phase 3.
          // eslint-disable-next-line no-console
          console.log('start workout')
        }}
        className="mt-4 active:opacity-90"
      >
        <View
          className="flex-row items-center justify-between rounded-3xl bg-white p-5"
          style={CARD_SHADOW}
        >
          <View className="flex-1">
            <Text className="font-sans text-[12px] text-slate-500">
              Today&apos;s workout
            </Text>
            <Text className="mt-1 font-sans-semibold text-[16px] text-slate-900">
              {data.nextWorkoutName ?? 'Rest day'}
            </Text>
          </View>

          <View
            className="h-11 flex-row items-center rounded-full bg-mint-500 px-5"
            style={{
              shadowColor: '#2BBF9E',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 5,
            }}
          >
            <Text className="font-sans-semibold text-[13px] text-white">
              Start
            </Text>
            <Text className="ml-2 font-sans-semibold text-[15px] text-white">
              {'\u2192'}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Top bar — greeting + date + avatar circle.
// ─────────────────────────────────────────────

interface TopBarProps {
  greeting: string
  profileName: string
  dateLabel: string
}

function TopBar({
  greeting,
  profileName,
  dateLabel,
}: TopBarProps): React.ReactElement {
  const initial = profileName.charAt(0).toUpperCase() || 'H'

  return (
    <View className="flex-row items-start justify-between">
      <View className="flex-1 pr-4">
        <Text
          className="font-sans-semibold text-[22px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          {`${greeting}, ${profileName}`}
        </Text>
        <Text className="mt-1 font-sans text-[13px] text-slate-500">
          {dateLabel}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={() => {
          router.push('/settings')
        }}
        className="active:opacity-80"
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-full bg-mint-100"
          style={SOFT_CARD_SHADOW}
        >
          <Text className="font-sans-semibold text-[14px] text-slate-700">
            {initial}
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Hero metric column (one half of the calories + protein card).
// ─────────────────────────────────────────────

interface HeroMetricProps {
  label: string
  value: string
  unit: string
  goalText: string
  progressPct: number
  fillClass: 'bg-mint-500' | 'bg-mint-600'
  valueClass: string
}

function HeroMetric({
  label,
  value,
  unit,
  goalText,
  progressPct,
  fillClass,
  valueClass,
}: HeroMetricProps): React.ReactElement {
  return (
    <View className="flex-1">
      <Text className="font-sans text-[12px] text-slate-500">{label}</Text>

      <View className="mt-1 flex-row items-baseline">
        <Text
          className={`font-sans-bold text-[32px] ${valueClass}`}
          style={{ letterSpacing: -0.8 }}
        >
          {value}
        </Text>
        {unit !== '' ? (
          <Text className="ml-1 font-sans-medium text-[13px] text-slate-400">
            {unit}
          </Text>
        ) : null}
      </View>

      <Text className="mt-0.5 font-sans text-[12px] text-slate-400">
        {goalText}
      </Text>

      <View className="mt-3 h-1 overflow-hidden rounded-full bg-mint-100">
        <View
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${progressPct * 100}%` }}
        />
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Mini stat cell (workouts / weight / water row).
// ─────────────────────────────────────────────

interface MiniStatCardProps {
  label: string
  value: string
  sublabel: string
  valueTone?: 'default' | 'coral'
  onPress?: () => void
  accessibilityLabel?: string
}

function MiniStatCard({
  label,
  value,
  sublabel,
  valueTone = 'default',
  onPress,
  accessibilityLabel,
}: MiniStatCardProps): React.ReactElement {
  const valueColor =
    valueTone === 'coral' ? 'text-brand-coral' : 'text-slate-900'

  const inner = (
    <View
      className="flex-1 rounded-3xl bg-white p-4"
      style={SOFT_CARD_SHADOW}
    >
      <Text className="font-sans text-[11px] text-slate-500">{label}</Text>
      <Text
        className={`mt-1 font-sans-bold text-[22px] ${valueColor}`}
        style={{ letterSpacing: -0.5 }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 font-sans text-[11px] text-slate-400">
        {sublabel}
      </Text>
    </View>
  )

  if (onPress != null) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        className="flex-1 active:opacity-90"
      >
        {inner}
      </Pressable>
    )
  }

  return inner
}

// ─────────────────────────────────────────────
// Empty / not-set-up states.
// ─────────────────────────────────────────────

function LoadingState({
  loading,
}: {
  loading: boolean
}): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center pt-40">
      <View
        className="h-14 w-14 items-center justify-center rounded-full bg-white"
        style={SOFT_CARD_SHADOW}
      >
        <View className="h-6 w-6 rounded-full bg-mint-300" />
      </View>
      <Text className="mt-4 font-sans text-[13px] text-slate-500">
        {loading ? 'Loading your day…' : 'Preparing dashboard'}
      </Text>
    </View>
  )
}

function NotSetUpState(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center pt-24">
      <View
        className="w-full rounded-3xl bg-white p-7"
        style={HERO_CARD_SHADOW}
      >
        <View className="items-center">
          <View
            className="h-16 w-16 items-center justify-center rounded-full bg-mint-100"
            style={SOFT_CARD_SHADOW}
          >
            <Text className="font-sans-bold text-[22px] text-mint-600">H</Text>
          </View>

          <Text
            className="mt-5 text-center font-sans-bold text-[20px] text-slate-900"
            style={{ letterSpacing: -0.3, lineHeight: 26 }}
          >
            Complete onboarding{'\n'}to see your dashboard
          </Text>
          <Text
            className="mt-3 text-center font-sans text-[13px] text-slate-500"
            style={{ lineHeight: 20 }}
          >
            We&apos;ll calculate your calorie and protein targets and start
            tracking from there.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start onboarding"
          onPress={() => {
            router.push('/(onboarding)')
          }}
          className="mt-6 active:opacity-90"
        >
          <View
            className="items-center rounded-full bg-mint-500 py-4"
            style={{
              shadowColor: '#2BBF9E',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 6,
            }}
          >
            <Text className="font-sans-semibold text-[15px] text-white">
              Start onboarding
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Small pure formatting helpers — kept local so the hook stays data-only.
// ─────────────────────────────────────────────

function clampPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  const pct = numerator / denominator
  if (pct < 0) return 0
  if (pct > 1) return 1
  return pct
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString()
}

function formatOneDecimal(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(1)
}

function formatLiters(ml: number): string {
  if (!Number.isFinite(ml) || ml <= 0) return '0.0'
  return (ml / 1000).toFixed(1)
}
