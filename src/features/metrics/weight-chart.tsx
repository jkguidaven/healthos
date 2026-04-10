/**
 * src/features/metrics/weight-chart.tsx
 *
 * Inline SVG line chart for the 30-day weight trend on the Body tab.
 *
 * Drawn with react-native-svg (already installed) rather than victory-native
 * to keep the dependency graph lean. Mint line, soft mint area fill below,
 * dot at the latest point. Empty state renders a calm placeholder instead
 * of an empty chart frame.
 */

import React from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import type { BodyMetric } from '@db/schema'

interface WeightChartProps {
  points: BodyMetric[]
  height?: number
}

// Mint tokens pulled out so they match the Tailwind palette.
const MINT_LINE = '#2BBF9E' // mint-500
const MINT_FILL = 'rgba(43, 191, 158, 0.12)' // mint-500 @ 12%
const MINT_DOT_RING = '#FFFFFF'
const AXIS_LINE = 'rgba(26, 39, 39, 0.06)' // slate-900 @ 6%

export function WeightChart({
  points,
  height = 128,
}: WeightChartProps): React.ReactElement {
  // Empty / low-signal state — fewer than 2 points can't make a line.
  if (points.length < 2) {
    return (
      <View
        className="mt-3 items-center justify-center rounded-2xl bg-mint-50"
        style={{ height }}
      >
        <Text className="font-sans text-[12px] text-slate-400">
          Log a few weigh-ins to see your trend
        </Text>
      </View>
    )
  }

  // Measure the chart in a fixed viewBox and let SVG scale to the container.
  const viewW = 320
  const viewH = height
  const padX = 12
  const padY = 16

  const weights = points.map((p) => p.weightKg)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  // Give the line some breathing room when the range is tiny or zero.
  const pad = Math.max(0.4, (maxW - minW) * 0.25)
  const domainMin = minW - pad
  const domainMax = maxW + pad
  const domain = domainMax - domainMin

  const innerW = viewW - padX * 2
  const innerH = viewH - padY * 2

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1)) * innerW
    const yRatio = (p.weightKg - domainMin) / domain
    const y = padY + (1 - yRatio) * innerH
    return { x, y }
  })

  // Line path — plain polyline via SVG path commands.
  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
    .join(' ')

  // Area path — same line plus a closing rect to the baseline.
  const baseY = padY + innerH
  const first = coords[0]
  const last = coords[coords.length - 1]
  const areaPath =
    `M${first.x.toFixed(2)} ${baseY.toFixed(2)} ` +
    coords
      .map((c) => `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ') +
    ` L${last.x.toFixed(2)} ${baseY.toFixed(2)} Z`

  const latest = coords[coords.length - 1]

  // Format the date range label (oldest → newest).
  const firstDate = formatShort(points[0].date)
  const lastDate = formatShort(points[points.length - 1].date)

  return (
    <View className="mt-3">
      <Svg
        width="100%"
        height={viewH}
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="none"
      >
        {/* Soft baseline for context */}
        <Line
          x1={padX}
          y1={baseY}
          x2={viewW - padX}
          y2={baseY}
          stroke={AXIS_LINE}
          strokeWidth={1}
        />
        {/* Area fill under the line */}
        <Path d={areaPath} fill={MINT_FILL} />
        {/* The line itself */}
        <Path
          d={linePath}
          fill="none"
          stroke={MINT_LINE}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* White halo + mint dot at the most recent point */}
        <Circle
          cx={latest.x}
          cy={latest.y}
          r={6}
          fill={MINT_DOT_RING}
          stroke={MINT_LINE}
          strokeWidth={2}
        />
        <Circle cx={latest.x} cy={latest.y} r={2.5} fill={MINT_LINE} />
      </Svg>

      <View className="mt-2 flex-row items-center justify-between">
        <Text className="font-sans text-[11px] text-slate-400">
          {firstDate}
        </Text>
        <Text className="font-sans text-[11px] text-slate-400">
          {lastDate}
        </Text>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Format an ISO date (YYYY-MM-DD) as a short month/day, e.g. "Mar 8". */
function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
