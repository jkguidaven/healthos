import React from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

interface ProgressRingProps {
  progress: number
  size?: number
  strokeWidth?: number
  color?: string
}

export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 6,
  color = '#1D9E75',
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progress))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (clamped / 100) * circumference
  const center = size / 2

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e4e4e7"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
    </View>
  )
}
