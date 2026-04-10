import React, { forwardRef } from 'react'
import { View, Text, TextInput } from 'react-native'

interface InputProps {
  label?: string
  error?: string
  hint?: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'email-address'
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    hint,
    value,
    onChangeText,
    placeholder,
    secureTextEntry = false,
    keyboardType = 'default',
  },
  ref,
) {
  return (
    <View className="w-full">
      {label ? (
        <Text className="mb-1 text-[10px] text-zinc-400 dark:text-zinc-600">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
      {error ? (
        <Text className="mt-1 text-[10px] text-brand-coral">{error}</Text>
      ) : hint ? (
        <Text className="mt-1 text-[9px] text-zinc-400 dark:text-zinc-600">
          {hint}
        </Text>
      ) : null}
    </View>
  )
})
