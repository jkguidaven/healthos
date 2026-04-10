import React from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { ScreenLayout } from '@components/layouts/screen-layout'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'

interface FeatureItem {
  label: string
  dotClass: string
}

const FEATURES: readonly FeatureItem[] = [
  { label: 'AI food scanner', dotClass: 'bg-brand-green' },
  { label: 'AI workout plans', dotClass: 'bg-brand-purple' },
  { label: 'Body fat tracking', dotClass: 'bg-brand-coral' },
  { label: 'Recomp coach', dotClass: 'bg-brand-amber' },
] as const

export function WelcomeScreen(): React.ReactElement {
  const handleGetStarted = (): void => {
    router.push('/(onboarding)/profile')
  }

  return (
    <ScreenLayout>
      <View className="flex-1 justify-center">
        {/* App icon */}
        <View className="items-center">
          <View className="h-[52px] w-[52px] items-center justify-center rounded-2xl border-2 border-brand-green bg-teal-100">
            <Text className="text-[20px] font-medium text-brand-green">H</Text>
          </View>
        </View>

        {/* App name */}
        <Text className="mt-3.5 text-center text-[17px] font-medium text-zinc-900 dark:text-zinc-100">
          HealthOS
        </Text>

        {/* Tagline */}
        <Text className="mt-1.5 text-center text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          Track. Train. Transform.{'\n'}Your local-first recomposition companion.
        </Text>

        {/* Feature list */}
        <View className="mt-5 gap-1.5">
          {FEATURES.map((feature) => (
            <Card key={feature.label} variant="secondary" padding="sm">
              <View className="flex-row items-center gap-2.5">
                <View
                  className={`h-2 w-2 rounded-full ${feature.dotClass}`}
                />
                <Text className="text-[11px] text-zinc-700 dark:text-zinc-300">
                  {feature.label}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        {/* CTA */}
        <View className="mt-5">
          <Button onPress={handleGetStarted}>Get started</Button>
        </View>

        {/* Trust line */}
        <Text className="mt-2.5 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
          All data stays on your device · no account needed
        </Text>
      </View>
    </ScreenLayout>
  )
}
