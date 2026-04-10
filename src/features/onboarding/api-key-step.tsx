import React, { useState } from 'react'
import { Linking, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { clearApiKey, saveApiKey, validateApiKey } from '@ai/api-key'

type ValidationStatus = 'idle' | 'validating' | 'success' | 'error'
type ErrorCode = 'invalid_key' | 'network_error' | 'rate_limit'

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_key: 'Key was rejected by Google AI Studio',
  network_error: 'Check your connection and try again',
  rate_limit: 'Rate limit hit — try again in a moment',
}

const STUDIO_URL = 'https://aistudio.google.com/apikey'

const MINT_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const

function ctaLabel(status: ValidationStatus): string {
  if (status === 'error') return 'Try again'
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

  const handleOpenStudio = (): void => {
    void Linking.openURL(STUDIO_URL)
  }

  const handleToggleShow = (): void => {
    setShowKey((prev) => !prev)
  }

  const handleBack = (): void => {
    router.back()
  }

  const isCtaDisabled =
    status === 'validating' || status === 'success' || key.trim().length === 0

  return (
    <View className="flex-1 bg-mint-100">
      {/* Soft mint gradient background */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 200, left: -80 }}
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6">
          {/* === TOP NAV: back + step dots === */}
          <View className="flex-row items-center justify-between pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
              hitSlop={8}
            >
              <Text className="font-sans-medium text-[22px] text-slate-700">
                ←
              </Text>
            </Pressable>

            <View
              className="flex-row items-center gap-2"
              accessibilityRole="progressbar"
              accessibilityLabel="Onboarding progress, step 3 of 3"
            >
              <View className="h-2 w-2 rounded-full bg-mint-500" />
              <View className="h-2 w-2 rounded-full bg-mint-500" />
              <View className="h-2 w-2 rounded-full bg-mint-500" />
            </View>

            {/* Spacer to balance the back button */}
            <View className="h-10 w-10" />
          </View>

          {/* === HEADLINE === */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Connect Gemini
            </Text>
            <Text
              className="mt-3 font-sans text-[15px] text-slate-600"
              style={{ lineHeight: 22 }}
            >
              Powers food scanning, workout plans, and your daily coach.
              Free tier — no credit card required.
            </Text>
          </View>

          {/* === INFO CARD (security reassurance) === */}
          <View
            className="mt-8 flex-row items-start gap-3 rounded-3xl bg-white p-5"
            style={MINT_SHADOW}
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-mint-100">
              <Text className="text-[15px]">🔒</Text>
            </View>
            <Text
              className="flex-1 font-sans text-[13px] text-slate-700"
              style={{ lineHeight: 19 }}
            >
              Your key is stored securely on this device using the system
              keychain. It&apos;s only ever sent to Google&apos;s servers.
            </Text>
          </View>

          {/* === API KEY INPUT CARD === */}
          <View
            className="mt-4 rounded-3xl bg-white p-5"
            style={MINT_SHADOW}
          >
            <Input
              label="Gemini API key"
              value={key}
              onChangeText={setKey}
              placeholder="AIza…"
              secureTextEntry={!showKey}
            />

            <View className="mt-3 flex-row items-center justify-between">
              <Pressable
                onPress={handleToggleShow}
                accessibilityRole="button"
                className="active:opacity-60"
                hitSlop={8}
              >
                <Text className="font-sans-medium text-[13px] text-mint-600">
                  {showKey ? 'Hide key' : 'Show key'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleOpenStudio}
                accessibilityRole="link"
                className="active:opacity-60"
                hitSlop={8}
              >
                <Text className="font-sans-medium text-[13px] text-mint-600">
                  Get a free key at aistudio.google.com →
                </Text>
              </Pressable>
            </View>
          </View>

          {/* === VALIDATION STATUS === */}
          {status === 'success' ? (
            <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-mint-200 bg-mint-50 p-4">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-mint-500">
                <Text className="font-sans-bold text-[11px] text-white">
                  ✓
                </Text>
              </View>
              <Text className="flex-1 font-sans-medium text-[13px] text-mint-700">
                Key validated — you&apos;re all set
              </Text>
            </View>
          ) : null}

          {status === 'error' && errorCode ? (
            <View className="mt-4 flex-row items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <View className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <Text className="flex-1 font-sans-medium text-[13px] text-red-700">
                {ERROR_MESSAGES[errorCode]}
              </Text>
            </View>
          ) : null}

          {/* === SPACER === */}
          <View className="flex-1" />

          {/* === CTA === */}
          <View className="pb-4">
            <Button
              onPress={() => {
                void handleValidate()
              }}
              loading={status === 'validating'}
              disabled={isCtaDisabled}
            >
              {ctaLabel(status)}
            </Button>

            <Pressable
              onPress={() => {
                void handleSkip()
              }}
              accessibilityRole="button"
              className="mt-4 items-center active:opacity-60"
              hitSlop={8}
            >
              <Text className="font-sans-medium text-[13px] text-slate-500">
                Skip for now
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
