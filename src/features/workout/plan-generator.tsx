/**
 * src/features/workout/plan-generator.tsx
 *
 * Layer 2 — "Generate workout plan" modal screen.
 *
 * Presented as a slide-up modal over the workout tab. The user picks:
 *   • Training split       — PPL / Upper-Lower / Full body
 *   • Days per week        — 2 / 3 / 4 / 5 / 6
 *   • Plan duration        — 4 / 6 / 8 / 12 weeks
 *   • Equipment available  — multi-select chips
 *
 * On Generate we call useWorkoutPlan().generate which hits Gemini via the
 * shared ai-client, runs the result through Zod, persists the plan into
 * SQLite inside a single transaction, and returns the new planId. While
 * that mutation is in flight we render a full-screen mint spinner overlay
 * ("Building your plan..."). On failure a friendly error card overlay
 * surfaces instead, with messages narrowed from the AI error .code.
 *
 * Visual language: flat white page surface with rounded-3xl white cards
 * separated by subtle slate borders. Mint fills the selected option
 * chips and the primary CTA. Poppins-only typography.
 */

import React, { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@components/ui/button'
import {
  useWorkoutPlan,
  type GeneratePlanFormInput,
} from '@features/workout/use-workout-plan'

// ─────────────────────────────────────────────
// The modal overlays (loading + error) still lift off the page with a
// soft neutral drop shadow so the dim backdrop stays legible.
// ─────────────────────────────────────────────

const OVERLAY_CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.25,
  shadowRadius: 28,
  elevation: 10,
} as const

// ─────────────────────────────────────────────
// Static option tables
// ─────────────────────────────────────────────

type SplitValue = GeneratePlanFormInput['split']
type DaysPerWeek = GeneratePlanFormInput['daysPerWeek']
type DurationWeeks = GeneratePlanFormInput['durationWeeks']

interface SplitOption {
  value: SplitValue
  title: string
  subtitle: string
}

const SPLIT_OPTIONS: readonly SplitOption[] = [
  {
    value: 'ppl',
    title: 'Push / Pull / Legs',
    subtitle: 'Optimal for 4-6 day intermediate routines',
  },
  {
    value: 'upper_lower',
    title: 'Upper / Lower',
    subtitle: '4 days, balanced volume',
  },
  {
    value: 'full_body',
    title: 'Full body',
    subtitle: '2-3 days, beginner-friendly',
  },
] as const

const DAYS_OPTIONS: readonly DaysPerWeek[] = [2, 3, 4, 5, 6] as const

interface DurationOption {
  value: DurationWeeks
  label: string
}

const DURATION_OPTIONS: readonly DurationOption[] = [
  { value: 4, label: '4 weeks' },
  { value: 6, label: '6 weeks' },
  { value: 8, label: '8 weeks' },
  { value: 12, label: '12 weeks' },
] as const

const EQUIPMENT_OPTIONS: readonly string[] = [
  'Barbell',
  'Dumbbells',
  'Cable machine',
  'Pull-up bar',
  'Bench',
  'Squat rack',
  'Resistance bands',
  'Kettlebells',
  'Bodyweight only',
] as const

const DEFAULT_EQUIPMENT: readonly string[] = [
  'Barbell',
  'Dumbbells',
  'Bench',
] as const

// ─────────────────────────────────────────────
// Screen component
// ─────────────────────────────────────────────

export function PlanGenerator(): React.ReactElement {
  const [split, setSplit] = useState<SplitValue>('ppl')
  const [daysPerWeek, setDaysPerWeek] = useState<DaysPerWeek>(4)
  const [durationWeeks, setDurationWeeks] = useState<DurationWeeks>(8)
  const [equipment, setEquipment] = useState<string[]>([...DEFAULT_EQUIPMENT])

  const { generate, isGenerating, generateError, reset } = useWorkoutPlan()

  const toggleEquipment = (item: string): void => {
    setEquipment((current) =>
      current.includes(item)
        ? current.filter((e) => e !== item)
        : [...current, item],
    )
  }

  const handleGenerate = async (): Promise<void> => {
    try {
      await generate({ split, daysPerWeek, durationWeeks, equipment })
      // The plan view screen (issue #47) doesn't exist yet — for now we
      // just dismiss the modal. Once the workout index becomes the plan
      // view we can switch to router.replace('/(tabs)/workout').
      router.back()
    } catch {
      // React Query stores the error in generateError — the overlay
      // will render automatically from that state.
    }
  }

  const handleBack = (): void => {
    router.back()
  }

  const canGenerate = equipment.length > 0 && !isGenerating

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* === TOP BAR === */}
          <View className="flex-row items-center justify-between pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white active:opacity-80"
            >
              <Text
                className="font-sans-semibold text-[20px] text-slate-700"
                style={{ marginTop: -2 }}
              >
                {'\u2039'}
              </Text>
            </Pressable>

            <Text className="font-sans-semibold text-[18px] text-slate-900">
              Generate plan
            </Text>

            {/* Spacer for symmetry */}
            <View className="h-10 w-10" />
          </View>

          {/* === HERO === */}
          <View className="mt-7">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Build your plan
            </Text>
            <Text
              className="mt-3 font-sans text-[14px] text-slate-600"
              style={{ lineHeight: 21 }}
            >
              Tell us how you train and we&apos;ll generate a periodised plan.
            </Text>
          </View>

          {/* === CARD 1 — Training split === */}
          <View className="mt-7 rounded-3xl border border-slate-100 bg-white p-5">
            <Text className="font-sans-medium text-[13px] text-slate-600">
              Training split
            </Text>
            <View className="mt-3 gap-2">
              {SPLIT_OPTIONS.map((option) => {
                const selected = option.value === split
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.title}
                    onPress={() => setSplit(option.value)}
                    className={`rounded-2xl p-4 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`font-sans-semibold text-[15px] ${
                        selected ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {option.title}
                    </Text>
                    <Text
                      className={`mt-0.5 font-sans text-[12px] ${
                        selected ? 'text-white/85' : 'text-slate-500'
                      }`}
                    >
                      {option.subtitle}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* === CARD 2 — Days per week === */}
          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <Text className="font-sans-medium text-[13px] text-slate-600">
              Days per week
            </Text>
            <View className="mt-3 flex-row gap-2">
              {DAYS_OPTIONS.map((value) => {
                const selected = value === daysPerWeek
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${value} days per week`}
                    onPress={() => setDaysPerWeek(value)}
                    className={`flex-1 items-center justify-center rounded-full px-4 py-3 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`font-sans-semibold text-[15px] ${
                        selected ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {value}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* === CARD 3 — Duration === */}
          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <Text className="font-sans-medium text-[13px] text-slate-600">
              Plan duration
            </Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {DURATION_OPTIONS.map((option) => {
                const selected = option.value === durationWeeks
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                    onPress={() => setDurationWeeks(option.value)}
                    className={`rounded-full px-4 py-3 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`font-sans-semibold text-[13px] ${
                        selected ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {/* === CARD 4 — Equipment === */}
          <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
            <View className="flex-row items-center justify-between">
              <Text className="font-sans-medium text-[13px] text-slate-600">
                Equipment available
              </Text>
              <Text className="font-sans text-[11px] text-slate-400">
                {equipment.length} selected
              </Text>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((item) => {
                const selected = equipment.includes(item)
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={item}
                    onPress={() => toggleEquipment(item)}
                    className={`rounded-full px-3 py-2 active:opacity-90 ${
                      selected ? 'bg-mint-500' : 'bg-slate-50'
                    }`}
                  >
                    <Text
                      className={`font-sans-medium text-[12px] ${
                        selected ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
            {equipment.length === 0 ? (
              <Text className="mt-3 font-sans text-[12px] text-brand-coral">
                Pick at least one piece of equipment.
              </Text>
            ) : null}
          </View>

          {/* === GENERATE CTA === */}
          <View className="mt-8">
            <Button
              variant="primary"
              loading={isGenerating}
              disabled={!canGenerate}
              onPress={() => {
                void handleGenerate()
              }}
            >
              Generate plan
            </Button>
            <Text className="mt-3 text-center font-sans text-[11px] text-slate-500">
              Takes about 10-15 seconds
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* === LOADING OVERLAY === */}
      {isGenerating ? <GeneratingOverlay /> : null}

      {/* === ERROR OVERLAY === */}
      {generateError && !isGenerating ? (
        <GenerateErrorOverlay error={generateError} onDismiss={reset} />
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Loading overlay — mint spinner in a floating card
// ─────────────────────────────────────────────

function GeneratingOverlay(): React.ReactElement {
  return (
    <View
      className="absolute inset-0 items-center justify-center bg-slate-900/25"
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel="Building your workout plan"
    >
      <View
        className="w-[260px] items-center rounded-3xl bg-white p-6"
        style={OVERLAY_CARD_SHADOW}
      >
        <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-50">
          <ActivityIndicator size="large" color="#2BBF9E" />
        </View>
        <Text
          className="mt-5 text-center font-sans-semibold text-[16px] text-slate-900"
          style={{ letterSpacing: -0.2 }}
        >
          Building your plan{'\u2026'}
        </Text>
        <Text className="mt-1.5 text-center font-sans text-[13px] text-slate-500">
          This usually takes 10-15 seconds.
        </Text>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Error overlay — friendly message narrowed from the AI error .code
// ─────────────────────────────────────────────

interface GenerateErrorOverlayProps {
  error: Error
  onDismiss: () => void
}

function friendlyGenerateErrorMessage(error: Error): {
  title: string
  body: string
} {
  const code = (error as { code?: string }).code
  switch (code) {
    case 'key_missing':
      return {
        title: 'API key missing',
        body: 'Add your Gemini API key in Settings to generate a workout plan.',
      }
    case 'key_invalid':
      return {
        title: 'API key rejected',
        body: 'Your Gemini key was rejected. Update it in Settings and try again.',
      }
    case 'rate_limit':
      return {
        title: 'Slow down a sec',
        body: 'Gemini is rate-limiting requests. Try again in a moment.',
      }
    case 'parse_error':
      return {
        title: 'Couldn\u2019t read the response',
        body: 'Gemini returned something unexpected. Try generating again.',
      }
    case 'api_error': {
      const status = (error as { status?: number }).status
      if (status === 503 || status === 502 || status === 504) {
        return {
          title: 'Gemini is busy',
          body: 'Google\u2019s servers are overloaded right now — try again in a moment.',
        }
      }
      if (status && status >= 500) {
        return {
          title: 'Gemini server error',
          body: `Google returned an error (HTTP ${status}). Try again in a moment.`,
        }
      }
      return {
        title: 'Couldn\u2019t generate',
        body: 'Something went wrong talking to Gemini. Check your connection and try again.',
      }
    }
    default:
      return {
        title: 'Couldn\u2019t generate',
        body: error.message || 'Something went wrong. Try again.',
      }
  }
}

function GenerateErrorOverlay({
  error,
  onDismiss,
}: GenerateErrorOverlayProps): React.ReactElement {
  const { title, body } = friendlyGenerateErrorMessage(error)

  return (
    <View
      className="absolute inset-0 items-center justify-center bg-slate-900/25 px-6"
      pointerEvents="auto"
    >
      <View
        className="w-full max-w-[340px] rounded-3xl bg-white p-6"
        style={OVERLAY_CARD_SHADOW}
      >
        <View className="items-center">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-brand-coral/15">
            <Text className="font-sans-bold text-[22px] text-brand-coral">
              !
            </Text>
          </View>
        </View>
        <Text
          className="mt-4 text-center font-sans-bold text-[18px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        <Text
          className="mt-2 text-center font-sans text-[13px] text-slate-600"
          style={{ lineHeight: 19 }}
        >
          {body}
        </Text>
        <View className="mt-5">
          <Button onPress={onDismiss}>Try again</Button>
        </View>
      </View>
    </View>
  )
}
