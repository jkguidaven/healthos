/**
 * src/components/ui/api-key-banner.tsx
 *
 * Inline banners that surface API-key issues above any AI-powered CTA
 * (food scan, workout plan generation, coach digest, etc.). Two
 * variants:
 *
 *   - <ApiKeyMissingBanner />  → "AI features need an API key"
 *   - <ApiKeyInvalidBanner />  → "API key was rejected — it may have expired"
 *
 * Both share the soft purple surface from the design system (matches
 * the AI coach hero card on the dashboard) and link to the Settings →
 * API key screen. Tapping the link uses expo-router so the screen can
 * be reached from any tab.
 *
 * Most callers won't import the variants directly — they use the
 * smart <ApiKeyBanner /> wrapper which reads the status from useApiKey()
 * and renders the right one (or nothing) automatically.
 */

import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'

import { useApiKey } from '@/lib/ai/use-api-key'

const SETTINGS_ROUTE = '/settings/api-key'

interface BannerShellProps {
  title: string
  cta: string
  onPress: () => void
}

function BannerShell({ title, cta, onPress }: BannerShellProps): React.ReactElement {
  return (
    <View className="rounded-3xl border border-purple-100 bg-purple-50 p-5">
      <View className="flex-row items-start gap-3">
        <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-purple-100">
          <Text className="font-sans-bold text-[14px] text-purple-600">!</Text>
        </View>
        <View className="flex-1">
          <Text
            className="font-sans-semibold text-[14px] text-purple-700"
            style={{ lineHeight: 20 }}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={cta}
            onPress={onPress}
            hitSlop={6}
            className="mt-2 self-start active:opacity-60"
          >
            <Text className="font-sans-semibold text-[12px] text-brand-blue">
              {cta} →
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Concrete variants — exported so callers can render them directly
// when they want to skip the smart wrapper.
// ─────────────────────────────────────────────

export function ApiKeyMissingBanner(): React.ReactElement {
  return (
    <BannerShell
      title="AI features need an API key"
      cta="Configure in Settings"
      onPress={() => {
        router.push(SETTINGS_ROUTE)
      }}
    />
  )
}

export function ApiKeyInvalidBanner(): React.ReactElement {
  return (
    <BannerShell
      title="API key was rejected — it may have expired"
      cta="Update key in Settings"
      onPress={() => {
        router.push(SETTINGS_ROUTE)
      }}
    />
  )
}

// ─────────────────────────────────────────────
// Smart wrapper — read status from useApiKey() and pick the right
// variant. Renders nothing when the key is fine, so call sites can
// drop it directly above any AI CTA without conditionals.
// ─────────────────────────────────────────────

export function ApiKeyBanner(): React.ReactElement | null {
  const { status } = useApiKey()
  if (status === 'missing') return <ApiKeyMissingBanner />
  if (status === 'invalid') return <ApiKeyInvalidBanner />
  return null
}
