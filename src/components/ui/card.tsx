import React from 'react'
import { View } from 'react-native'

interface CardProps {
  variant?: 'primary' | 'secondary'
  padding?: 'sm' | 'md' | 'lg'
  className?: string
  children: React.ReactNode
}

const paddingMap: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({
  variant = 'primary',
  padding = 'md',
  className = '',
  children,
}: CardProps) {
  const isPrimary = variant === 'primary'
  const background = isPrimary ? 'bg-white' : 'bg-slate-50'

  return (
    <View
      className={`rounded-3xl ${background} ${paddingMap[padding]} ${className}`}
      style={
        isPrimary
          ? {
              shadowColor: '#1D9E75',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 3,
            }
          : undefined
      }
    >
      {children}
    </View>
  )
}
