import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'

export function WelcomeScreen(): React.ReactElement {
  const handleGetStarted = (): void => {
    router.push('/(onboarding)/profile')
  }

  return (
    <View className="flex-1 bg-mint-100">
      {/* Soft mint gradient background */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles in the background */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 120, left: -80 }}
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6">
          {/* === SPACER TOP === */}
          <View className="flex-1" />

          {/* === ICON / AVATAR === */}
          <View className="items-center">
            <View
              className="h-32 w-32 rounded-full bg-white items-center justify-center"
              style={{
                shadowColor: '#1D9E75',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 8,
              }}
            >
              <View className="h-24 w-24 rounded-full bg-mint-400 items-center justify-center">
                <Text className="font-sans-bold text-[44px] text-white">H</Text>
              </View>
            </View>
          </View>

          {/* === HEADLINE === */}
          <View className="mt-10 items-center">
            <Text className="font-sans-bold text-[32px] text-slate-900 text-center" style={{ lineHeight: 38 }}>
              Welcome to{'\n'}HealthOS
            </Text>
            <Text className="font-sans text-[15px] text-slate-600 text-center mt-4 px-4" style={{ lineHeight: 22 }}>
              Your personal companion for{'\n'}body recomposition.
            </Text>
          </View>

          {/* === SPACER MIDDLE === */}
          <View className="flex-1" />

          {/* === CTA === */}
          <View className="pb-4">
            <Pressable
              onPress={handleGetStarted}
              className="active:opacity-90"
              accessibilityRole="button"
              accessibilityLabel="Get started"
            >
              <View
                className="rounded-full bg-mint-500 py-5 items-center"
                style={{
                  shadowColor: '#2BBF9E',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <Text className="font-sans-semibold text-[16px] text-white">
                  Get Started
                </Text>
              </View>
            </Pressable>

            <Text className="font-sans text-[12px] text-slate-600 text-center mt-4">
              All your data stays on this device
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
