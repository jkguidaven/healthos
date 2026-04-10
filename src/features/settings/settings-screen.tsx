/**
 * src/features/settings/settings-screen.tsx
 *
 * Overlay 5 — Settings.
 *
 * Reached by tapping the avatar in the dashboard header. Presents the user
 * with a small number of elegant grouped cards:
 *   1. AI      — masked Gemini key + read-only model name
 *   2. Profile — edit profile, units, notifications
 *   3. Data    — export, remove key (destructive)
 *
 * Visual language: flat white page surface, Poppins throughout,
 * rounded-3xl white cards separated by a subtle slate border. Section
 * titles live *inside* each card in small slate-500 SemiBold 13px.
 * Rows are full-width pressables separated by faint slate-100 bottom
 * borders.
 *
 * The raw API key never touches this component; the masked version is
 * produced by `useMaskedApiKey()`.
 */

import React, { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { clearApiKey } from '@ai/api-key'
import { useMaskedApiKey } from './use-api-key'
import { useDataExport } from './use-data-export'

type UnitPreference = 'metric' | 'imperial'

const MODEL_NAME = 'gemini-2.5-flash'
const APP_VERSION = 'v0.1'

export function SettingsScreen(): React.ReactElement {
  const { masked, loading } = useMaskedApiKey()
  const { exportAll, isExporting, lastExportedAt } = useDataExport()
  const [units, setUnits] = useState<UnitPreference>('metric')
  const [notificationsOn, setNotificationsOn] = useState<boolean>(true)

  const handleBack = (): void => {
    router.back()
  }

  const handleUpdateKey = (): void => {
    router.push('/settings/api-key')
  }

  const handleEditProfile = (): void => {
    router.push('/(onboarding)/profile')
  }

  const handleToggleUnits = (): void => {
    setUnits((prev) => (prev === 'metric' ? 'imperial' : 'metric'))
  }

  const handleToggleNotifications = (value: boolean): void => {
    setNotificationsOn(value)
  }

  const handleExport = (): void => {
    if (isExporting) return
    void (async (): Promise<void> => {
      try {
        await exportAll()
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Could not export your data.'
        Alert.alert('Export failed', message)
      }
    })()
  }

  const exportSubtitle = describeExportStatus(isExporting, lastExportedAt)

  const handleRemoveKey = (): void => {
    Alert.alert(
      'Remove API key?',
      'This will remove your Gemini API key and disable AI features. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async (): Promise<void> => {
              await clearApiKey()
              router.replace('/(onboarding)/api-key')
            })()
          },
        },
      ],
    )
  }

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* === TOP BAR === */}
        <View className="flex-row items-center justify-between px-6 pt-2">
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

          <Text className="font-sans-semibold text-[18px] text-slate-900">
            Settings
          </Text>

          {/* Spacer balancing the back button */}
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* === CARD 1 — AI === */}
          <Section title="AI">
            <Row
              label="Gemini API key"
              right={
                <View className="flex-row items-center">
                  <Text className="font-sans text-[12px] text-slate-500">
                    {loading ? '…' : masked}
                  </Text>
                  <Text className="ml-3 font-sans-medium text-[13px] text-mint-600">
                    Update
                  </Text>
                </View>
              }
              onPress={handleUpdateKey}
            />
            <Row
              label="Model"
              isLast
              right={
                <Text className="font-sans text-[12px] text-slate-500">
                  {MODEL_NAME}
                </Text>
              }
            />
          </Section>

          {/* === CARD 2 — Profile === */}
          <View className="h-4" />
          <Section title="Profile">
            <Row
              label="Edit profile"
              right={<Chevron />}
              onPress={handleEditProfile}
            />
            <Row
              label="Units"
              right={
                <View className="flex-row items-center">
                  <Text className="font-sans text-[12px] text-slate-500">
                    {units === 'metric' ? 'Metric' : 'Imperial'}
                  </Text>
                  <View className="ml-3">
                    <Chevron />
                  </View>
                </View>
              }
              onPress={handleToggleUnits}
            />
            <Row
              label="Notifications"
              isLast
              right={
                <Switch
                  value={notificationsOn}
                  onValueChange={handleToggleNotifications}
                  trackColor={{ false: '#E2E8F0', true: '#7BDAB9' }}
                  thumbColor={notificationsOn ? '#1D9E75' : '#F8FAFC'}
                  ios_backgroundColor="#E2E8F0"
                />
              }
            />
          </Section>

          {/* === CARD 3 — Data === */}
          <View className="h-4" />
          <Section title="Data">
            <Row
              label="Export all data"
              subtitle={exportSubtitle}
              onPress={handleExport}
              right={
                isExporting ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#1D9E75" />
                    <Text className="ml-2 font-sans-medium text-[13px] text-mint-600">
                      Exporting…
                    </Text>
                  </View>
                ) : (
                  <Chevron />
                )
              }
            />
            <Row
              label="Remove API key"
              labelClassName="text-brand-coral"
              isLast
              right={
                <Text className="font-sans-medium text-[13px] text-brand-coral">
                  Remove
                </Text>
              }
              onPress={handleRemoveKey}
            />
          </Section>

          {/* === Footer === */}
          <View className="mt-8 items-center">
            <Text className="font-sans text-[11px] text-slate-400">
              HealthOS · {APP_VERSION}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface SectionProps {
  title: string
  children: React.ReactNode
}

function Section({ title, children }: SectionProps): React.ReactElement {
  return (
    <View className="rounded-3xl border border-slate-100 bg-white px-5 pb-2 pt-5">
      <Text className="mb-3 font-sans-semibold text-[13px] text-slate-500">
        {title}
      </Text>
      <View>{children}</View>
    </View>
  )
}

interface RowProps {
  label: string
  right: React.ReactNode
  onPress?: () => void
  isLast?: boolean
  labelClassName?: string
  subtitle?: string
}

function Row({
  label,
  right,
  onPress,
  isLast = false,
  labelClassName,
  subtitle,
}: RowProps): React.ReactElement {
  const borderClass = isLast ? '' : 'border-b border-slate-100'
  const labelColorClass = labelClassName ?? 'text-slate-900'

  const content = (
    <View
      className={`flex-row items-center justify-between py-4 ${borderClass}`}
    >
      <View className="flex-1 pr-4">
        <Text
          className={`font-sans-medium text-[14px] ${labelColorClass}`}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 font-sans text-[12px] text-slate-500">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center">{right}</View>
    </View>
  )

  if (!onPress) {
    return content
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="active:opacity-60"
    >
      {content}
    </Pressable>
  )
}

function Chevron(): React.ReactElement {
  return (
    <Text className="font-sans-medium text-[18px] text-slate-300">›</Text>
  )
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ONE_MINUTE_MS = 60 * 1_000
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS
const ONE_DAY_MS = 24 * ONE_HOUR_MS

/**
 * Build the subtitle line under "Export all data".
 *
 * - Idle, never exported  → reassures the user nothing leaves the device.
 * - Exporting             → mirrors the spinner so the row reads as busy.
 * - Just finished (<1 min)→ "Just exported".
 * - Recent (<1 h)         → "Last exported: N minutes ago".
 * - Older                 → coarser "X hours / days ago".
 */
function describeExportStatus(
  isExporting: boolean,
  lastExportedAt: Date | null,
): string {
  if (isExporting) return 'Preparing your data…'
  if (!lastExportedAt) return 'All data stays on your device'

  const elapsedMs = Date.now() - lastExportedAt.getTime()
  if (elapsedMs < ONE_MINUTE_MS) return 'Just exported'

  if (elapsedMs < ONE_HOUR_MS) {
    const minutes = Math.floor(elapsedMs / ONE_MINUTE_MS)
    return `Last exported ${minutes} minute${minutes === 1 ? '' : 's'} ago`
  }

  if (elapsedMs < ONE_DAY_MS) {
    const hours = Math.floor(elapsedMs / ONE_HOUR_MS)
    return `Last exported ${hours} hour${hours === 1 ? '' : 's'} ago`
  }

  const days = Math.floor(elapsedMs / ONE_DAY_MS)
  return `Last exported ${days} day${days === 1 ? '' : 's'} ago`
}
