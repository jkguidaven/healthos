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
        <Text className="mb-2 font-sans-medium text-[13px] text-slate-600">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A9494"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        className={`rounded-2xl border bg-slate-50 px-4 py-4 font-sans-medium text-[15px] text-slate-900 ${
          error ? 'border-brand-coral' : 'border-slate-100'
        }`}
      />
      {error ? (
        <Text className="mt-2 font-sans text-[12px] text-brand-coral">
          {error}
        </Text>
      ) : hint ? (
        <Text className="mt-2 font-sans text-[12px] text-slate-400">
          {hint}
        </Text>
      ) : null}
    </View>
  )
})
