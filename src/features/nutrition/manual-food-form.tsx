/**
 * src/features/nutrition/manual-food-form.tsx
 *
 * Layer 4 — Manual food entry screen (issue #38).
 *
 * The fallback path for logging a meal when the camera / AI scanner
 * isn't useful. Pure form screen: food name, calories, macros, meal
 * selector. Saves directly to the food_log table as `source: 'manual'`
 * and routes back to the nutrition tab.
 *
 * Visual language mirrors the rest of the mint design system:
 *   - 3-stop mint gradient background + decorative blurred circles
 *   - rounded-3xl white card with mint shadow
 *   - Poppins-only typography
 *   - rounded-full primary CTA, soft pill meal selector
 *
 * No StyleSheet.create, no raw SQL, no `any`, no direct fetch.
 */

import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'

import { defaultMealForNow, useSaveManualFood } from './use-manual-food'

// ─────────────────────────────────────────────
// Schema + types
// ─────────────────────────────────────────────

export const MEAL_VALUES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type Meal = (typeof MEAL_VALUES)[number]

export const manualFoodSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  calories: z.coerce.number().int().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500).default(0),
  carbsG: z.coerce.number().min(0).max(500).default(0),
  fatG: z.coerce.number().min(0).max(500).default(0),
  meal: z.enum(MEAL_VALUES),
})

export type ManualFoodValues = z.infer<typeof manualFoodSchema>

// ─────────────────────────────────────────────
// Form input shape — everything the user types is a string until the
// resolver coerces it. Matches the pattern used in profile-form.tsx.
// ─────────────────────────────────────────────

interface ManualFoodFormInput {
  name: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  meal: Meal
}

const DEFAULT_VALUES = (): ManualFoodFormInput => ({
  name: '',
  calories: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
  meal: defaultMealForNow(),
})

// ─────────────────────────────────────────────
// Shadow tokens (matched to the mint surface)
// ─────────────────────────────────────────────

const HERO_CARD_SHADOW = {
  shadowColor: '#1D9E75',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.15,
  shadowRadius: 24,
  elevation: 8,
} as const

// ─────────────────────────────────────────────
// Meal selector configuration
// ─────────────────────────────────────────────

interface MealOption {
  value: Meal
  label: string
  emoji: string
}

const MEAL_OPTIONS: readonly MealOption[] = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { value: 'lunch', label: 'Lunch', emoji: '🥗' },
  { value: 'dinner', label: 'Dinner', emoji: '🍽️' },
  { value: 'snack', label: 'Snack', emoji: '🍎' },
] as const

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function ManualFoodForm(): React.ReactElement {
  const { save } = useSaveManualFood()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // See `profile-form.tsx` — `z.coerce.number()` widens the schema's
  // input type, so we cast the resolver to preserve our string-based
  // form input type while still getting the typed output on submit.
  const resolver = zodResolver(
    manualFoodSchema,
  ) as unknown as Resolver<ManualFoodFormInput, unknown, ManualFoodValues>

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ManualFoodFormInput, unknown, ManualFoodValues>({
    resolver,
    defaultValues: useMemo(DEFAULT_VALUES, []),
    mode: 'onChange',
  })

  const onSubmit = async (values: ManualFoodValues): Promise<void> => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await save(values)
      router.back()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not save entry',
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
      {/* Atmospheric 3-stop mint gradient — same as the rest of the app. */}
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles for depth. */}
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
          {/* ── TOP BAR ───────────────────────────── */}
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

            <Text
              className="font-sans-semibold text-[18px] text-slate-900"
              style={{ letterSpacing: -0.2 }}
            >
              Add manually
            </Text>

            {/* Spacer to balance the back button width. */}
            <View className="h-10 w-10" />
          </View>

          {/* ── HEADLINE ─────────────────────────── */}
          <View className="mt-8">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Log a meal
            </Text>
            <Text
              className="mt-2 font-sans text-[14px] text-slate-600"
              style={{ lineHeight: 20 }}
            >
              Type in the macros for what you ate.
            </Text>
          </View>

          {/* ── FORM CARD ────────────────────────── */}
          <View
            className="mt-8 rounded-3xl bg-white p-6"
            style={HERO_CARD_SHADOW}
          >
            {/* Food name */}
            <Controller
              control={control}
              name="name"
              render={({ field: { value, onChange } }) => (
                <Input
                  label="Food name"
                  value={value}
                  onChangeText={onChange}
                  placeholder="e.g. Greek yogurt with berries"
                  error={errors.name?.message}
                />
              )}
            />

            {/* Calories */}
            <View className="mt-5">
              <Controller
                control={control}
                name="calories"
                render={({ field: { value, onChange } }) => (
                  <Input
                    label="Calories (kcal)"
                    value={value}
                    onChangeText={onChange}
                    keyboardType="numeric"
                    placeholder="300"
                    error={errors.calories?.message}
                  />
                )}
              />
            </View>

            {/* Macros row */}
            <View className="mt-5 flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="proteinG"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Protein (g)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      error={errors.proteinG?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="carbsG"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Carbs (g)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      error={errors.carbsG?.message}
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="fatG"
                  render={({ field: { value, onChange } }) => (
                    <Input
                      label="Fat (g)"
                      value={value}
                      onChangeText={onChange}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      error={errors.fatG?.message}
                    />
                  )}
                />
              </View>
            </View>

            {/* Meal selector */}
            <View className="mt-6">
              <Text className="mb-2 font-sans-medium text-[13px] text-slate-600">
                Meal
              </Text>
              <Controller
                control={control}
                name="meal"
                render={({ field: { value, onChange } }) => (
                  <View className="flex-row flex-wrap gap-2">
                    {MEAL_OPTIONS.map((option) => (
                      <MealPill
                        key={option.value}
                        label={option.label}
                        emoji={option.emoji}
                        selected={value === option.value}
                        onPress={() => onChange(option.value)}
                      />
                    ))}
                  </View>
                )}
              />
            </View>
          </View>

          {submitError ? (
            <Text className="mt-4 font-sans text-[13px] text-brand-coral">
              {submitError}
            </Text>
          ) : null}

          {/* Spacer pushes CTA to the bottom when content is short. */}
          <View className="flex-1" />

          {/* ── CTA ──────────────────────────────── */}
          <View className="mt-8">
            <Button
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting || !isValid}
            >
              Save entry
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

// ─────────────────────────────────────────────
// Meal pill — one option in the meal selector row.
// ─────────────────────────────────────────────

interface MealPillProps {
  label: string
  emoji: string
  selected: boolean
  onPress: () => void
}

function MealPill({
  label,
  emoji,
  selected,
  onPress,
}: MealPillProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={`flex-row items-center rounded-full px-4 py-2.5 active:opacity-80 ${
        selected ? 'bg-mint-500' : 'bg-slate-50'
      }`}
      style={
        selected
          ? {
              shadowColor: '#2BBF9E',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 4,
            }
          : undefined
      }
    >
      <Text className="mr-1.5 text-[13px]">{emoji}</Text>
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
