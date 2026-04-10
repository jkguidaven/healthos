import React from 'react'
import { View, Text, Pressable } from 'react-native'

interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg'
  onPress?: () => void
}

interface SizeConfig {
  container: string
  text: string
}

const sizes: Record<NonNullable<AvatarProps['size']>, SizeConfig> = {
  sm: { container: 'h-8 w-8', text: 'text-[12px]' },
  md: { container: 'h-10 w-10', text: 'text-[14px]' },
  lg: { container: 'h-[52px] w-[52px]', text: 'text-[18px]' },
}

export function Avatar({ initials, size = 'md', onPress }: AvatarProps) {
  const config = sizes[size]
  const content = (
    <View
      className={`${config.container} items-center justify-center rounded-full bg-teal-100`}
    >
      <Text className={`${config.text} font-medium text-teal-800`}>
        {initials}
      </Text>
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Avatar ${initials}`}
        onPress={onPress}
      >
        {content}
      </Pressable>
    )
  }

  return content
}
