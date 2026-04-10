/**
 * src/features/settings/api-key-settings.tsx
 *
 * Update Gemini API key screen — opened as a push from the settings screen.
 *
 * Simpler than the onboarding step: no progress dots, no "skip for now", no
 * hero explanation of what Gemini is. Just a focused update card on a flat
 * white page, matching the main-app visual language.
 *
 * Flow:
 *   1. User pastes a new key
 *   2. Tap "Validate & save" → useUpdateApiKey validates via Google
 *   3. On success: brief inline confirmation, then router.back() after 600ms
 *   4. On failure: inline error state, user can try again
 *
 * The raw key stays local to this component's state until saved. It is
 * cleared from state on success, and never logged.
 */

import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import type { ValidationErrorCode } from '@ai/api-key'
import { useUpdateApiKey } from './use-api-key'

const STUDIO_URL = 'https://aistudio.google.com/apikey'

const ERROR_MESSAGES: Record<ValidationErrorCode, string> = {
  invalid_key: 'Key was rejected by Google AI Studio',
  network_error: 'Check your connection and try again',
  rate_limit: 'Rate limit hit — try again in a moment',
}

function ctaLabel(status: string): string {
  if (status === 'error') return 'Try again'
  if (status === 'success') return 'Saved'
  return 'Validate & save'
}

export function ApiKeySettings(): React.ReactElement {
  const [key, setKey] = useState<string>('')
  const [showKey, setShowKey] = useState<boolean>(false)
  const { status, errorCode, update, reset } = useUpdateApiKey()

  const handleValidate = async (): Promise<void> => {
    await update(key)
  }

  // On success, clear local state + navigate back after a beat so the user
  // sees the confirmation card.
  React.useEffect(() => {
    if (status !== 'success') return
    setKey('')
    const timer = setTimeout(() => {
      router.back()
    }, 600)
    return () => clearTimeout(timer)
  }, [status])

  const handleBack = (): void => {
    router.back()
  }

  const handleToggleShow = (): void => {
    setShowKey((prev) => !prev)
  }

  const handleOpenStudio = (): void => {
    void Linking.openURL(STUDIO_URL)
  }

  const handleKeyChange = (value: string): void => {
    setKey(value)
    // If the user is editing after an error, clear the error state so the
    // inline message disappears until they retry.
    if (status === 'error') reset()
  }

  const isCtaDisabled =
    status === 'validating' || status === 'success' || key.trim().length === 0

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingBottom: 24,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* === TOP BAR === */}
          <View className="flex-row items-center justify-between pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
            >
              <Text className="font-sans-semibold text-[22px] text-slate-700">
                ‹
              </Text>
            </Pressable>

            <Text className="font-sans-semibold text-[16px] text-slate-900">
              Update Gemini API key
            </Text>

            <View className="h-10 w-10" />
          </View>

          {/* === HEADLINE === */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Update your key
            </Text>
            <Text
              className="mt-3 font-sans text-[15px] text-slate-600"
              style={{ lineHeight: 22 }}
            >
              Replace the existing key with a new one.
            </Text>
          </View>

          {/* === INFO CARD === */}
          <View className="mt-8 flex-row items-start gap-3 rounded-3xl border border-slate-100 bg-white p-5">
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

          {/* === INPUT CARD === */}
          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <Input
              label="New Gemini API key"
              value={key}
              onChangeText={handleKeyChange}
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
                Key updated
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
          <View className="pb-4 pt-8">
            <Button
              onPress={() => {
                void handleValidate()
              }}
              loading={status === 'validating'}
              disabled={isCtaDisabled}
            >
              {ctaLabel(status)}
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
