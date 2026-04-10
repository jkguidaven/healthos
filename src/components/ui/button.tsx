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
        className={`w-full rounded-full border border-mint-300 bg-white py-5 active:opacity-80 ${
          isDisabled ? 'opacity-50' : ''
        }`}
      >
        <View className="items-center justify-center">
          {loading ? (
            <ActivityIndicator
              size="small"
              color="#15805F"
              accessibilityLabel="Loading"
            />
          ) : (
            <Text className="font-sans-semibold text-[16px] text-mint-700">
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
      className={`w-full rounded-full bg-mint-500 py-5 active:opacity-90 ${
        isDisabled ? 'opacity-50' : ''
      }`}
      style={{
        shadowColor: '#2BBF9E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDisabled ? 0 : 0.3,
        shadowRadius: 16,
        elevation: isDisabled ? 0 : 6,
      }}
    >
      <View className="items-center justify-center">
        {loading ? (
          <ActivityIndicator
            size="small"
            color="#ffffff"
            accessibilityLabel="Loading"
          />
        ) : (
          <Text className="font-sans-semibold text-[16px] text-white">
            {children}
          </Text>
        )}
      </View>
    </Pressable>
  )
}
