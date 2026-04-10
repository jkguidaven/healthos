import React from 'react'
import { Text } from 'react-native'

interface SectionHeaderProps {
  children: React.ReactNode
}

export function SectionHeader({ children }: SectionHeaderProps) {
  return (
    <Text
      className="mb-1.5 text-[9px] uppercase text-zinc-400 dark:text-zinc-600"
      style={{ letterSpacing: 0.5 }}
    >
      {children}
    </Text>
  )
}
