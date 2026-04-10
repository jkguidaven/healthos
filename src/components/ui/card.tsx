import React from 'react'
import { View } from 'react-native'

interface CardProps {
  variant?: 'primary' | 'secondary'
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-2',
  md: 'p-2.5',
  lg: 'p-3',
}

export function Card({
  variant = 'primary',
  padding = 'md',
  className = '',
  children,
}: CardProps) {
  const background =
    variant === 'secondary'
      ? 'bg-zinc-50 dark:bg-zinc-800'
      : 'bg-white dark:bg-zinc-900'

  return (
    <View
      className={`rounded-lg ${background} ${paddingMap[padding]} ${className}`}
    >
      {children}
    </View>
  )
}
