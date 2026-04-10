/**
 * src/features/dashboard/dashboard-screen.tsx
 *
 * Layer 4 — Home tab. The daily at-a-glance view across the four pillars:
 * nutrition, training, body, coach.
 *
 * Visual language: flat white page surface, rounded-3xl white cards
 * separated by a subtle slate border, mint accents reserved for pills,
 * CTAs, and status badges. Poppins typography, generous whitespace.
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
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { MacroBar } from '@components/ui/macro-bar'
import { useDashboard, type DashboardData } from './use-dashboard'

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function DashboardScreen(): React.ReactElement {
  const { data, loading } = useDashboard()

  return (
    <View className="flex-1 bg-white">
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
      <View className="mt-6 rounded-3xl border border-slate-100 bg-white p-6">
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

        {/* Surplus / deficit / maintenance status */}
        {data.maintenanceTdee != null ? (
          <CalorieGoalStatus
            goalCalories={data.goalCalories}
            maintenanceTdee={data.maintenanceTdee}
          />
        ) : null}

        {!hasAnyFoodLogged ? (
          <View className="mt-3 rounded-2xl bg-mint-50 px-4 py-3">
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
      <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
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
        <View className="rounded-3xl border border-mint-100 bg-mint-50 p-5">
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
          onPress={() => {
            router.push('/(tabs)/workout')
          }}
          accessibilityLabel="Open workout tab"
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
          sublabel={waterSublabel(data.todayWaterMl, data.waterTarget)}
          progressPct={(data.todayWaterMl / data.waterTarget) * 100}
          icon="water"
          iconColor="#2BBF9E"
          iconBg="bg-mint-100"
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
        <View className="flex-row items-center justify-between rounded-3xl border border-slate-100 bg-white p-5">
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
        <View className="h-10 w-10 items-center justify-center rounded-full bg-mint-100">
          <Text className="font-sans-semibold text-[14px] text-slate-700">
            {initial}
          </Text>
        </View>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Calorie goal status pill — surfaces deficit / surplus / maintenance
// so the user always knows whether they're eating above or below
// maintenance for their current goal phase.
// ─────────────────────────────────────────────

interface CalorieGoalStatusProps {
  goalCalories: number
  maintenanceTdee: number
}

function CalorieGoalStatus({
  goalCalories,
  maintenanceTdee,
}: CalorieGoalStatusProps): React.ReactElement {
  const delta = goalCalories - maintenanceTdee
  const isSurplus = delta > 0
  const isDeficit = delta < 0

  const bg = isSurplus
    ? 'bg-mint-50'
    : isDeficit
      ? 'bg-amber-50'
      : 'bg-slate-50'
  const border = isSurplus
    ? 'border-mint-100'
    : isDeficit
      ? 'border-amber-100'
      : 'border-slate-100'
  const numberColor = isSurplus
    ? 'text-mint-700'
    : isDeficit
      ? 'text-amber-800'
      : 'text-slate-700'
  const iconBg = isSurplus
    ? 'bg-mint-100'
    : isDeficit
      ? 'bg-amber-100'
      : 'bg-slate-100'
  const iconName = isSurplus
    ? 'trending-up'
    : isDeficit
      ? 'trending-down'
      : 'remove'
  const iconColor = isSurplus ? '#15805F' : isDeficit ? '#92400E' : '#475569'

  const phaseLabel = isSurplus
    ? 'Calorie surplus'
    : isDeficit
      ? 'Calorie deficit'
      : 'Maintenance'
  const phaseSubtitle = isSurplus
    ? 'Fueling muscle growth'
    : isDeficit
      ? 'Burning fat'
      : 'Holding steady — recomp'
  const deltaLabel = isSurplus
    ? `+${delta.toLocaleString()}`
    : isDeficit
      ? delta.toLocaleString()
      : '0'

  return (
    <View className={`mt-5 rounded-2xl border ${border} ${bg} p-4`}>
      <View className="flex-row items-center gap-3">
        <View
          className={`h-11 w-11 items-center justify-center rounded-full ${iconBg}`}
        >
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="font-sans-semibold text-[13px] text-slate-700">
            {phaseLabel}
          </Text>
          <Text className="font-sans text-[11px] text-slate-500">
            {phaseSubtitle}
          </Text>
        </View>
        <View className="items-end">
          <Text
            className={`font-sans-bold text-[22px] ${numberColor}`}
            style={{ letterSpacing: -0.5 }}
          >
            {deltaLabel}
          </Text>
          <Text className="font-sans text-[10px] text-slate-500">
            kcal / day
          </Text>
        </View>
      </View>
      <Text className="mt-3 font-sans text-[11px] text-slate-500">
        Maintenance ≈ {maintenanceTdee.toLocaleString()} kcal · Target{' '}
        {goalCalories.toLocaleString()} kcal
      </Text>
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
  /** When provided (0-100), draws a thin progress bar at the bottom of
   * the card. Used by the Water tile so the user sees daily progress
   * toward the hydration target. Other tiles leave this undefined. */
  progressPct?: number
  /** Optional Ionicons name to render in a small accent circle in the
   * top-right of the card. Used to humanize stats that aren't obviously
   * a number (e.g. Water gets a 💧 droplet). */
  icon?: React.ComponentProps<typeof Ionicons>['name']
  iconColor?: string
  iconBg?: string
  onPress?: () => void
  accessibilityLabel?: string
}

function MiniStatCard({
  label,
  value,
  sublabel,
  valueTone = 'default',
  progressPct,
  icon,
  iconColor = '#15805F',
  iconBg = 'bg-mint-100',
  onPress,
  accessibilityLabel,
}: MiniStatCardProps): React.ReactElement {
  const valueColor =
    valueTone === 'coral' ? 'text-brand-coral' : 'text-slate-900'

  const clampedPct =
    progressPct != null ? Math.max(0, Math.min(100, progressPct)) : null

  const inner = (
    <View className="flex-1 rounded-3xl border border-slate-100 bg-white p-4">
      <View className="flex-row items-start justify-between">
        <Text className="font-sans text-[11px] text-slate-500">{label}</Text>
        {icon ? (
          <View className={`h-7 w-7 items-center justify-center rounded-full ${iconBg}`}>
            <Ionicons name={icon} size={14} color={iconColor} />
          </View>
        ) : null}
      </View>

      <Text
        className={`mt-1 font-sans-bold text-[22px] ${valueColor}`}
        style={{ letterSpacing: -0.5 }}
      >
        {value}
      </Text>
      <Text className="mt-0.5 font-sans text-[11px] text-slate-400">
        {sublabel}
      </Text>

      {clampedPct != null ? (
        <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-mint-50">
          <View
            className="h-full rounded-full bg-mint-500"
            style={{ width: `${clampedPct}%` }}
          />
        </View>
      ) : null}
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
      <View className="h-14 w-14 items-center justify-center rounded-full border border-slate-100 bg-white">
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
      <View className="w-full rounded-3xl border border-slate-100 bg-white p-7">
        <View className="items-center">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
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

/**
 * Friendlier sublabel for the Water mini-stat. Shows the remaining
 * litres needed to hit the goal, or a celebration when the user has
 * crossed the target. Falls back to "Tap to log" when nothing is
 * logged yet.
 */
function waterSublabel(currentMl: number, targetMl: number): string {
  if (currentMl <= 0) return 'Tap to log'
  if (currentMl >= targetMl) return 'Goal hit ✓'
  const remainingMl = targetMl - currentMl
  const remainingL = (remainingMl / 1000).toFixed(1)
  return `${remainingL} L to go`
}
