import React from 'react'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface ScreenLayoutProps {
  children: React.ReactNode
  scroll?: boolean
}

export function ScreenLayout({ children, scroll = false }: ScreenLayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-white px-4 dark:bg-zinc-900">
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1">{children}</View>
      )}
    </SafeAreaView>
  )
}
