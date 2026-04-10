import React from 'react'
import { ScrollView, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'

interface ScreenLayoutProps {
  children: React.ReactNode
  scroll?: boolean
  /** Adds a soft mint gradient background. Default true. */
  gradient?: boolean
}

export function ScreenLayout({
  children,
  scroll = false,
  gradient = true,
}: ScreenLayoutProps) {
  return (
    <View className="flex-1 bg-mint-50">
      {gradient ? (
        <LinearGradient
          colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
          locations={[0, 0.5, 1]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      {/* Soft decorative circles for atmospheric depth */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
        pointerEvents="none"
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 200, left: -80 }}
        pointerEvents="none"
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {scroll ? (
          <ScrollView
            className="flex-1 px-6"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View className="flex-1 px-6">{children}</View>
        )}
      </SafeAreaView>
    </View>
  )
}
