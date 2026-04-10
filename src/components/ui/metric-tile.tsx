import React from 'react'
import { View, Text } from 'react-native'

interface MetricTileProps {
  label: string
  value: string | number
  subtitle?: string
  progress?: number
  progressColor?: 'green' | 'purple' | 'amber' | 'coral'
}

const progressColorMap: Record<
  NonNullable<MetricTileProps['progressColor']>,
  string
> = {
  green: 'bg-brand-green',
  purple: 'bg-brand-purple',
  amber: 'bg-brand-amber',
  coral: 'bg-brand-coral',
}

export function MetricTile({
  label,
  value,
  subtitle,
  progress,
  progressColor = 'green',
}: MetricTileProps) {
  const clampedProgress =
    typeof progress === 'number'
      ? Math.max(0, Math.min(100, progress))
      : undefined

  return (
    <View className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800">
      <Text className="text-[9px] text-zinc-400 dark:text-zinc-600">
        {label}
      </Text>
      <Text className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </Text>
      {subtitle ? (
        <Text className="text-[9px] text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </Text>
      ) : null}
      {clampedProgress !== undefined ? (
        <View className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <View
            className={`h-full rounded-full ${progressColorMap[progressColor]}`}
            style={{ width: `${clampedProgress}%` }}
          />
        </View>
      ) : null}
    </View>
  )
}
