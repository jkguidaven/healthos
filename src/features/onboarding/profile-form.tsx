/**
 * src/features/onboarding/profile-form.tsx
 *
 * Layer 4 — Onboarding step 1 ("Tell us about yourself") screen component.
 *
 * Collects age, sex, height, weight and unit preference, shows a live BMR
 * calculation that updates on every keystroke, then persists the profile
 * row to SQLite via the useSaveProfileStep hook before routing the user
 * to the goal screen.
 *
 * Visual language mirrors the welcome screen: mint gradient background,
 * soft decorative circles, Poppins-only typography, rounded-3xl white cards
 * with mint shadows, rounded-full pill CTAs.
 *
 * No raw styles beyond shadow props — NativeWind classes only.
 */

import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { calculateBMR } from '@/lib/formulas/tdee'
import {
  profileFormSchema,
  useSaveProfileStep,
  type ProfileFormValues,
} from './use-onboarding'

// ─────────────────────────────────────────────
// Form input type (pre-coercion — everything is a string while the user
// is typing). Zod's z.coerce.number() converts to numbers on submit.
// ─────────────────────────────────────────────

interface ProfileFormInput {
  age: string
  sex: 'male' | 'female'
  heightCm: string
  weightKg: string
  units: 'metric' | 'imperial'
}

const DEFAULT_VALUES: ProfileFormInput = {
  age: '',
  sex: 'male',
  heightCm: '',
  weightKg: '',
  units: 'metric',
}

export function ProfileForm(): React.ReactElement {
  const saveProfileStep = useSaveProfileStep()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Cast the resolver because `z.coerce.number()` widens the schema's
  // input type to `unknown` while our form fields are strings. The
  // resolver still performs the exact same runtime validation.
  const resolver = zodResolver(
    profileFormSchema,
  ) as unknown as Resolver<ProfileFormInput, unknown, ProfileFormValues>

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileFormInput, unknown, ProfileFormValues>({
    resolver,
    defaultValues: DEFAULT_VALUES,
    mode: 'onChange',
  })

  // Watch every field so the BMR card updates live.
  const watchedFields = watch()

  const liveBmr = useMemo<number | null>(() => {
    const parsed = profileFormSchema.safeParse(watchedFields)
    if (!parsed.success) return null
    return calculateBMR({
      sex: parsed.data.sex,
      age: parsed.data.age,
      heightCm: parsed.data.heightCm,
      weightKg: parsed.data.weightKg,
    })
  }, [watchedFields])

  const onSubmit = async (values: ProfileFormValues): Promise<void> => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await saveProfileStep(values)
      router.push('/(onboarding)/goal')
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save profile',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBack = (): void => {
    router.back()
  }

  return (
    <View className="flex-1 bg-mint-100">
      {/* Soft mint gradient background */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles in the background */}
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
          {/* === TOP BAR — back arrow + step dots === */}
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

            <View
              className="flex-row items-center gap-2"
              accessibilityRole="progressbar"
              accessibilityLabel="Onboarding progress, step 1 of 3"
            >
              <View className="h-2 w-6 rounded-full bg-mint-500" />
              <View className="h-2 w-2 rounded-full bg-white/60" />
              <View className="h-2 w-2 rounded-full bg-white/60" />
            </View>

            {/* Spacer to balance back button width */}
            <View className="h-10 w-10" />
          </View>

          {/* === HEADLINE === */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Tell us about{'\n'}yourself
            </Text>
            <Text
              className="mt-3 font-sans text-[15px] text-slate-600"
              style={{ lineHeight: 22 }}
            >
              Just the basics — we&apos;ll calculate your daily targets.
            </Text>
          </View>

          {/* === FORM CARD === */}
          <View
            className="mt-8 rounded-3xl bg-white p-6"
            style={{
              shadowColor: '#1D9E75',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 8,
            }}
          >
            {/* Age + Sex row */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="age"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Age"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="numeric"
                      placeholder="28"
                      error={errors.age?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Text className="mb-2 font-sans-medium text-[13px] text-slate-600">
                  Sex
                </Text>
                <Controller
                  control={control}
                  name="sex"
                  render={({ field: { value, onChange } }) => (
                    <View className="flex-row rounded-full bg-slate-50 p-1">
                      <SexPill
                        sex="male"
                        selected={value === 'male'}
                        onPress={() => onChange('male')}
                      />
                      <SexPill
                        sex="female"
                        selected={value === 'female'}
                        onPress={() => onChange('female')}
                      />
                    </View>
                  )}
                />
              </View>
            </View>

            {/* Height + Weight row */}
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="heightCm"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Height (cm)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                      placeholder="175"
                      error={errors.heightCm?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="weightKg"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Weight (kg)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                      placeholder="72"
                      error={errors.weightKg?.message}
                    />
                  )}
                />
              </View>
            </View>

            {/* Units toggle */}
            <View className="mt-5">
              <Text className="mb-2 font-sans-medium text-[13px] text-slate-600">
                Units
              </Text>
              <Controller
                control={control}
                name="units"
                render={({ field: { value, onChange } }) => (
                  <View className="flex-row rounded-full bg-slate-50 p-1">
                    <PillSegment
                      label="Metric"
                      selected={value === 'metric'}
                      onPress={() => onChange('metric')}
                    />
                    <PillSegment
                      label="Imperial"
                      selected={value === 'imperial'}
                      onPress={() => onChange('imperial')}
                    />
                  </View>
                )}
              />
            </View>
          </View>

          {/* === LIVE BMR CARD === */}
          {liveBmr !== null ? (
            <View
              className="mt-4 rounded-3xl bg-white p-5"
              style={{
                shadowColor: '#1D9E75',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 6,
              }}
            >
              <Text className="font-sans-medium text-[13px] text-slate-500">
                Estimated daily energy
              </Text>
              <View className="mt-1 flex-row items-baseline">
                <Text
                  className="font-sans-bold text-[32px] text-slate-900"
                  style={{ letterSpacing: -0.5 }}
                >
                  {liveBmr.toLocaleString()}
                </Text>
                <Text className="ml-2 font-sans-medium text-[14px] text-mint-600">
                  kcal / day
                </Text>
              </View>
              <Text className="mt-1 font-sans text-[11px] text-slate-400">
                Mifflin-St Jeor formula
              </Text>
            </View>
          ) : null}

          {submitError ? (
            <Text className="mt-4 font-sans text-[13px] text-brand-coral">
              {submitError}
            </Text>
          ) : null}

          {/* === SPACER === */}
          <View className="flex-1" />

          {/* === CONTINUE CTA === */}
          <View className="mt-8">
            <Button
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Continue
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Sub-component — a single pill inside a capsule toggle group.
// ─────────────────────────────────────────────

interface PillSegmentProps {
  label: string
  selected: boolean
  onPress: () => void
}

function PillSegment({
  label,
  selected,
  onPress,
}: PillSegmentProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-full px-4 py-3 active:opacity-80 ${
        selected ? 'bg-mint-500' : 'bg-transparent'
      }`}
    >
      <Text
        className={`font-sans-semibold text-[13px] ${
          selected ? 'text-white' : 'text-slate-600'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Sex pill — icon-only variant for the cramped Age + Sex two-column row.
// Uses Ionicons male/female symbols so the toggle never wraps on small
// phones. The accessibility label still reads as "Male" / "Female" for
// screen readers.
// ─────────────────────────────────────────────

interface SexPillProps {
  sex: 'male' | 'female'
  selected: boolean
  onPress: () => void
}

function SexPill({
  sex,
  selected,
  onPress,
}: SexPillProps): React.ReactElement {
  const label = sex === 'male' ? 'Male' : 'Female'
  const iconName = sex === 'male' ? 'man' : 'woman'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-full py-3 active:opacity-80 ${
        selected ? 'bg-mint-500' : 'bg-transparent'
      }`}
    >
      <Ionicons
        name={iconName}
        size={22}
        color={selected ? '#FFFFFF' : '#475569'}
      />
    </Pressable>
  )
}
