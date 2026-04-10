import React from 'react'
import { Pressable, Text, ActivityIndicator, View } from 'react-native'

interface ButtonProps {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  disabled?: boolean
  onPress: () => void
  children: React.ReactNode
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading

  if (variant === 'secondary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        disabled={isDisabled}
        onPress={onPress}
        className={`w-full rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800 ${
          isDisabled ? 'opacity-50' : ''
        }`}
      >
        <View className="items-center justify-center">
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#71717a"
              accessibilityLabel="Loading"
            />
          ) : (
            <Text className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {children}
            </Text>
          )}
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      className={`w-full rounded-lg bg-brand-green p-2.5 ${
        isDisabled ? 'opacity-50' : ''
      }`}
    >
      <View className="items-center justify-center">
        {loading ? (
          <ActivityIndicator
            size="small"
            color="#ffffff"
            accessibilityLabel="Loading"
          />
        ) : (
          <Text className="text-[13px] font-medium text-white">{children}</Text>
        )}
      </View>
    </Pressable>
  )
}
