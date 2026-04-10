import React, { useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { ScreenLayout } from '@components/layouts/screen-layout'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'
import { Input } from '@components/ui/input'
import {
  clearApiKey,
  saveApiKey,
  validateApiKey,
} from '@ai/api-key'

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error'
type ErrorCode = 'invalid_key' | 'network_error' | 'rate_limit'

interface FeatureRow {
  label: string
  body: string
}

const FEATURES: readonly FeatureRow[] = [
  {
    label: 'FOOD SCANNER',
    body: 'Snap a photo, get macros',
  },
  {
    label: 'WORKOUT PLANNER',
    body: 'Claude builds your plan',
  },
  {
    label: 'DAILY COACHING',
    body: 'Recomp insights from your data',
  },
] as const

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_key: 'Key was rejected by Anthropic',
  network_error: 'Check your connection and try again',
  rate_limit: 'Rate limit hit — try again in a moment',
}

const CONSOLE_URL = 'https://console.anthropic.com'

function ctaLabel(status: ValidationStatus): string {
  if (status === 'validating') return 'Validating…'
  if (status === 'success') return 'Validated'
  return 'Validate & save'
}

export function ApiKeyStep(): React.ReactElement {
  const [key, setKey] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)
  const [status, setStatus] = useState<ValidationStatus>('idle')
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null)

  const handleValidate = async (): Promise<void> => {
    if (status === 'validating' || status === 'success') return
    if (key.trim().length === 0) return

    setStatus('validating')
    setErrorCode(null)

    const result = await validateApiKey(key)

    if (result.valid) {
      await saveApiKey(key)
      setStatus('success')
      setKey('')
      setTimeout(() => {
        router.replace('/(tabs)')
      }, 600)
      return
    }

    setErrorCode(result.error ?? 'network_error')
    setStatus('error')
  }

  const handleSkip = async (): Promise<void> => {
    await clearApiKey()
    router.replace('/(tabs)')
  }

  const handleOpenConsole = (): void => {
    void Linking.openURL(CONSOLE_URL)
  }

  const handleToggleShow = (): void => {
    setShowKey((prev) => !prev)
  }

  const isInputDisabled = status === 'validating' || status === 'success'
  const isCtaDisabled =
    status === 'validating' || status === 'success' || key.trim().length === 0

  return (
    <ScreenLayout scroll>
      <View className="flex-1 pt-4">
        {/* Progress bar — 3 of 3 filled */}
        <View
          className="mb-3.5 flex-row gap-1"
          accessibilityRole="progressbar"
          accessibilityLabel="Onboarding progress, step 3 of 3"
        >
          <View className="h-3 flex-1 rounded-full bg-brand-green" />
          <View className="h-3 flex-1 rounded-full bg-brand-green" />
          <View className="h-3 flex-1 rounded-full bg-brand-green" />
        </View>

        {/* Title */}
        <Text className="text-[17px] font-medium text-zinc-900 dark:text-zinc-100">
          Connect Claude AI
        </Text>

        {/* Subtitle */}
        <Text className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          Powers food scanning, workout plans & coaching
        </Text>

        {/* Info card */}
        <View className="mb-3 rounded-lg bg-purple-50 p-2.5 dark:bg-purple-900/30">
          <Text className="text-[11px] leading-relaxed text-purple-900 dark:text-purple-100">
            HealthOS uses the Anthropic Claude API for AI features. Your key is
            stored securely on this device and never sent anywhere except
            Anthropic&apos;s servers.
          </Text>
        </View>

        {/* API key input */}
        <Input
          label="ANTHROPIC API KEY"
          value={key}
          onChangeText={setKey}
          placeholder="sk-ant-api03-…"
          secureTextEntry={!showKey}
        />

        {/* Show/hide toggle */}
        <Pressable
          onPress={handleToggleShow}
          accessibilityRole="button"
          disabled={isInputDisabled}
          className="mt-1 self-end"
        >
          <Text className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {showKey ? 'Hide key' : 'Show key'}
          </Text>
        </Pressable>

        {/* Get key link */}
        <Pressable
          onPress={handleOpenConsole}
          accessibilityRole="link"
          className="mb-3 mt-1 self-end"
        >
          <Text className="text-[11px] text-brand-blue">
            Get a free key at console.anthropic.com →
          </Text>
        </Pressable>

        {/* CTA */}
        <Button
          onPress={() => {
            void handleValidate()
          }}
          loading={status === 'validating'}
          disabled={isCtaDisabled}
        >
          {ctaLabel(status)}
        </Button>

        {/* Status row */}
        {status === 'success' ? (
          <View className="mt-2.5 rounded-lg bg-teal-50 p-2.5 dark:bg-teal-900/30">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-brand-green" />
              <Text className="text-[11px] text-brand-green">
                Key validated — you&apos;re all set
              </Text>
            </View>
          </View>
        ) : null}

        {status === 'error' && errorCode ? (
          <View className="mt-2.5 rounded-lg bg-brand-coral/10 p-2.5 dark:bg-brand-coral/20">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-brand-coral" />
              <Text className="text-[11px] text-brand-coral">
                {ERROR_MESSAGES[errorCode]}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Feature unlock card */}
        <View className="mt-3">
          <Card variant="secondary" padding="md">
            <View className="gap-2">
              {FEATURES.map((feature) => (
                <View key={feature.label}>
                  <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {feature.label}
                  </Text>
                  <Text className="text-[11px] text-zinc-700 dark:text-zinc-300">
                    {feature.body}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Skip link */}
        <Pressable
          onPress={() => {
            void handleSkip()
          }}
          accessibilityRole="button"
          className="mt-3 items-center"
        >
          <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Skip for now (some features unavailable)
          </Text>
        </Pressable>
      </View>
    </ScreenLayout>
  )
}
