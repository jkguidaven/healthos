import React from 'react'
import { View, Text } from 'react-native'

interface ConfidenceBadgeProps {
  type: 'high' | 'medium' | 'low' | 'barcode'
}

interface BadgeConfig {
  dot: string
  text: string
  label: string
}

const configs: Record<ConfidenceBadgeProps['type'], BadgeConfig> = {
  high: {
    dot: 'bg-brand-green',
    text: 'text-brand-green',
    label: 'AI scan · high',
  },
  medium: {
    dot: 'bg-brand-amber',
    text: 'text-brand-amber',
    label: 'AI scan · medium',
  },
  low: {
    dot: 'bg-brand-coral',
    text: 'text-brand-coral',
    label: 'Low confidence',
  },
  barcode: {
    dot: 'bg-brand-blue',
    text: 'text-brand-blue',
    label: 'Barcode scan',
  },
}

export function ConfidenceBadge({ type }: ConfidenceBadgeProps) {
  const config = configs[type]
  return (
    <View className="flex-row items-center self-start rounded-full bg-zinc-50 px-1.5 py-0.5 dark:bg-zinc-800">
      <View className={`mr-1 h-1.5 w-1.5 rounded-full ${config.dot}`} />
      <Text className={`text-[8px] font-medium ${config.text}`}>
        {config.label}
      </Text>
    </View>
  )
}
