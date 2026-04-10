/**
 * src/features/metrics/body-fat-form.tsx
 *
 * Layer 4 — Body fat calculator screen.
 *
 * A focused detail screen (Expo Router presents it as a pushed route) where
 * the user enters waist + neck (+ hip for females) measurements. As they
 * type, the Navy body fat formula runs live and a hero result card reveals
 * itself. Saving upserts today's body_metric row and routes back to the
 * body tab.
 *
 * Visual language: mint gradient + soft decorative circles + rounded-3xl
 * white cards with mint shadows + Poppins. Mirrors the welcome / onboarding
 * screens so the whole flow feels cohesive.
 *
 * All logic lives in `use-body-fat.ts`. This component is pure presentation
 * glue.
 */

import React, { useEffect } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { BODY_FAT_CATEGORY_LABEL } from '@formulas/body-fat'
import { useProfileStore } from '@/stores/profile-store'
import { useBodyFat } from './use-body-fat'

// ─────────────────────────────────────────────
// Shared shadow objects
// ─────────────────────────────────────────────

const CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.15,
  shadowRadius: 24,
  elevation: 8,
} as const

const RESULT_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.28,
  shadowRadius: 28,
  elevation: 10,
} as const

const TOP_BUTTON_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 3,
} as const

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function BodyFatForm(): React.ReactElement | null {
  const profile = useProfileStore((s) => s.profile)
  const { values, setField, liveResult, save, isSaving, saveSuccess, saveError } =
    useBodyFat()

  // Navigate back once the upsert resolves successfully.
  useEffect(() => {
    if (saveSuccess) {
      router.back()
    }
  }, [saveSuccess])

  if (!profile) return null

  const isFemale = profile.sex === 'female'

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
        style={{ width: 280, height: 280, top: -90, right: -110 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 220, height: 220, bottom: -60, left: -90 }}
      />

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
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={12}
              className="h-11 w-11 items-center justify-center rounded-full bg-white/70 active:opacity-80"
              style={TOP_BUTTON_SHADOW}
            >
              <Text
                className="font-sans-semibold text-[20px] text-mint-700"
                style={{ marginTop: -2 }}
              >
                {'\u2190'}
              </Text>
            </Pressable>

            <Text className="font-sans-semibold text-[16px] text-slate-900">
              Body fat
            </Text>

            {/* Spacer to keep the title visually centered */}
            <View className="h-11 w-11" />
          </View>

          {/* === HEADLINE === */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              How are you{'\n'}measuring up?
            </Text>
            <Text
              className="mt-3 font-sans text-[14px] text-slate-600"
              style={{ lineHeight: 20 }}
            >
              US Navy method · takes 30 seconds.
            </Text>
          </View>

          {/* === FORM CARD === */}
          <View className="mt-7 rounded-3xl bg-white p-6" style={CARD_SHADOW}>
            <View className="gap-4">
              <Input
                label="Waist (cm)"
                value={values.waistCm}
                onChangeText={(v) => setField('waistCm', v)}
                placeholder="82"
                keyboardType="decimal-pad"
              />

              <Input
                label="Neck (cm)"
                value={values.neckCm}
                onChangeText={(v) => setField('neckCm', v)}
                placeholder="38"
                keyboardType="decimal-pad"
              />

              {isFemale ? (
                <Input
                  label="Hip (cm)"
                  value={values.hipCm}
                  onChangeText={(v) => setField('hipCm', v)}
                  placeholder="94"
                  keyboardType="decimal-pad"
                />
              ) : null}

              {/* Height — pulled from profile, non-editable */}
              <View className="w-full">
                <Text className="mb-2 font-sans-medium text-[13px] text-slate-600">
                  Height (cm)
                </Text>
                <View className="flex-row items-center rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
                  <Text className="flex-1 font-sans-medium text-[15px] text-slate-500">
                    {profile.heightCm}
                  </Text>
                  <View className="h-6 w-6 items-center justify-center rounded-full bg-mint-100">
                    <Text className="font-sans-semibold text-[11px] text-mint-700">
                      {'\uD83D\uDD12'}
                    </Text>
                  </View>
                </View>
                <Text className="mt-2 font-sans text-[12px] text-slate-400">
                  From your profile
                </Text>
              </View>
            </View>
          </View>

          {/* === INSTRUCTION CARD === */}
          <View className="mt-4 flex-row items-start gap-3 rounded-2xl bg-mint-50 p-4">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-mint-100">
              <Text className="text-[12px]">{'\uD83D\uDCCF'}</Text>
            </View>
            <Text
              className="flex-1 font-sans text-[13px] text-mint-800"
              style={{ lineHeight: 19 }}
            >
              Measure waist at navel level. Neck at the narrowest point below
              your larynx. Stand straight, breathe out.
            </Text>
          </View>

          {/* === LIVE RESULT CARD === */}
          {liveResult ? (
            <View
              className="mt-4 rounded-3xl bg-white p-6"
              style={RESULT_SHADOW}
            >
              <Text className="text-center font-sans-medium text-[13px] text-slate-500">
                Estimated body fat
              </Text>

              <View className="mt-1 flex-row items-baseline justify-center">
                <Text
                  className="font-sans-bold text-[56px] text-mint-600"
                  style={{ letterSpacing: -1.5, lineHeight: 62 }}
                >
                  {liveResult.bodyFatPct.toFixed(1)}
                </Text>
                <Text
                  className="ml-1 font-sans-bold text-[28px] text-mint-500"
                  style={{ letterSpacing: -0.5 }}
                >
                  %
                </Text>
              </View>

              <View className="mt-4 flex-row">
                <View className="flex-1 items-center">
                  <Text className="font-sans text-[12px] text-slate-500">
                    Lean mass
                  </Text>
                  <View className="mt-1 flex-row items-baseline">
                    <Text className="font-sans-semibold text-[18px] text-slate-900">
                      {liveResult.leanMassKg.toFixed(1)}
                    </Text>
                    <Text className="ml-1 font-sans text-[12px] text-slate-500">
                      kg
                    </Text>
                  </View>
                </View>

                <View className="w-px bg-slate-100" />

                <View className="flex-1 items-center">
                  <Text className="font-sans text-[12px] text-slate-500">
                    Fat mass
                  </Text>
                  <View className="mt-1 flex-row items-baseline">
                    <Text className="font-sans-semibold text-[18px] text-slate-900">
                      {liveResult.fatMassKg.toFixed(1)}
                    </Text>
                    <Text className="ml-1 font-sans text-[12px] text-slate-500">
                      kg
                    </Text>
                  </View>
                </View>
              </View>

              <View className="mt-5 items-center">
                <View className="rounded-full bg-mint-100 px-3 py-1">
                  <Text className="font-sans-medium text-[12px] text-mint-700">
                    {BODY_FAT_CATEGORY_LABEL[liveResult.category]}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {saveError ? (
            <Text className="mt-4 text-center font-sans text-[13px] text-brand-coral">
              {saveError.message}
            </Text>
          ) : null}

          {/* === SPACER === */}
          <View className="flex-1" />

          {/* === ACTION BUTTONS === */}
          <View className="mt-8 flex-row gap-3">
            <View className="flex-1">
              <Button variant="secondary" onPress={() => router.back()}>
                Cancel
              </Button>
            </View>
            <View className="flex-1">
              <Button
                onPress={save}
                loading={isSaving}
                disabled={liveResult === null || isSaving}
              >
                Save to log
              </Button>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}
