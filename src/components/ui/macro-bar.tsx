/**
 * src/components/ui/macro-bar.tsx
 *
 * Reusable horizontal segmented macro visualization. Used on the dashboard
 * and the food log screen to show how today's protein / carbs / fat break
 * down relative to each other.
 *
 * Pure — no state, no hooks, no data fetching. Deterministic from props.
 *
 * Visual language matches the friendly mint/Poppins system:
 *   - Container: mint-50 pill with overflow-hidden
 *   - Segments:  brand-purple (P) / brand-green (C) / brand-coral (F)
 *   - Legend:    dot + label + optional gram value in Poppins
 */

import React from 'react'
import { View, Text } from 'react-native'

// Brand pillar colors — straight from tailwind.config.js `brand` palette.
// Inlined as hex so we can pass them to the colored dots in the legend via
// `style={{ backgroundColor }}` (NativeWind classes work on the segments
// themselves, but the legend dots are easier to keep in sync here).
const MACRO_COLORS = {
  protein: '#534AB7', // brand-purple
  carbs: '#1D9E75', // brand-green
  fat: '#D85A30', // brand-coral
} as const

export interface MacroBarProps {
  proteinG: number
  carbsG: number
  fatG: number
  /** Bar height in px. Default 12. */
  height?: number
  /** Show the legend row below the bar. Default true. */
  showLegend?: boolean
  /** Show absolute gram numbers in the legend. Default true. */
  showGrams?: boolean
}

export function MacroBar({
  proteinG,
  carbsG,
  fatG,
  height = 12,
  showLegend = true,
  showGrams = true,
}: MacroBarProps): React.ReactElement {
  const safeProtein = clampNonNegative(proteinG)
  const safeCarbs = clampNonNegative(carbsG)
  const safeFat = clampNonNegative(fatG)

  const total = safeProtein + safeCarbs + safeFat
  const proteinPct = total > 0 ? safeProtein / total : 0
  const carbsPct = total > 0 ? safeCarbs / total : 0
  const fatPct = total > 0 ? safeFat / total : 0

  return (
    <View>
      <View
        testID="macro-bar-container"
        className="flex-row overflow-hidden rounded-full bg-mint-50"
        style={{ height }}
      >
        {total > 0 ? (
          <>
            <View
              testID="macro-bar-segment-protein"
              className="bg-brand-purple"
              style={{ flexGrow: proteinPct, flexShrink: 0, flexBasis: 0 }}
            />
            <View
              testID="macro-bar-segment-carbs"
              className="bg-brand-green"
              style={{ flexGrow: carbsPct, flexShrink: 0, flexBasis: 0 }}
            />
            <View
              testID="macro-bar-segment-fat"
              className="bg-brand-coral"
              style={{ flexGrow: fatPct, flexShrink: 0, flexBasis: 0 }}
            />
          </>
        ) : null}
      </View>

      {showLegend ? (
        <View className="mt-3 flex-row justify-between">
          <LegendItem
            color={MACRO_COLORS.protein}
            label="Protein"
            grams={safeProtein}
            showGrams={showGrams}
          />
          <LegendItem
            color={MACRO_COLORS.carbs}
            label="Carbs"
            grams={safeCarbs}
            showGrams={showGrams}
          />
          <LegendItem
            color={MACRO_COLORS.fat}
            label="Fat"
            grams={safeFat}
            showGrams={showGrams}
          />
        </View>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────

interface LegendItemProps {
  color: string
  label: string
  grams: number
  showGrams: boolean
}

function LegendItem({
  color,
  label,
  grams,
  showGrams,
}: LegendItemProps): React.ReactElement {
  return (
    <View className="flex-row items-center">
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Text className="ml-2 font-sans-medium text-[12px] text-slate-600">
        {label}
      </Text>
      {showGrams ? (
        <Text className="ml-1 font-sans text-[12px] text-slate-400">
          {`${formatGrams(grams)}g`}
        </Text>
      ) : null}
    </View>
  )
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  return value
}

function formatGrams(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toString()
}
