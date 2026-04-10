/**
 * src/features/onboarding/profile-form.tsx
 *
 * Layer 4 — Onboarding step 1 ("Basic info") screen component.
 *
 * Collects age, sex, height, weight and unit preference, shows a live BMR
 * calculation that updates on every keystroke, then persists the profile
 * row to SQLite via the useSaveProfileStep hook before routing the user
 * to the goal screen.
 *
 * No raw styles, no StyleSheet — NativeWind classes only.
 */

import React, { useMemo, useState } from 'react'
import { Text, View, Pressable } from 'react-native'
import { router } from 'expo-router'
import { useForm, Controller, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ScreenLayout } from '@components/layouts/screen-layout'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'
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

  return (
    <ScreenLayout scroll>
      <View className="flex-1 pt-4">
        {/* Progress bar — step 1 of 3 */}
        <View
          className="mb-3.5 flex-row gap-1"
          accessibilityRole="progressbar"
          accessibilityLabel="Onboarding progress, step 1 of 3"
        >
          <View className="h-3 flex-1 rounded-full bg-brand-green" />
          <View className="h-3 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <View className="h-3 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800" />
        </View>

        {/* Title + subtitle */}
        <Text className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">
          Basic info
        </Text>
        <Text className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          Used to calculate your TDEE and macro targets
        </Text>

        {/* Age + Sex row */}
        <View className="mb-2.5 flex-row gap-2.5">
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
            <Text className="mb-1 text-[10px] text-zinc-400 dark:text-zinc-600">
              Sex
            </Text>
            <Controller
              control={control}
              name="sex"
              render={({ field: { value, onChange } }) => (
                <View className="flex-row gap-1">
                  <SegmentButton
                    label="Male"
                    selected={value === 'male'}
                    onPress={() => onChange('male')}
                  />
                  <SegmentButton
                    label="Female"
                    selected={value === 'female'}
                    onPress={() => onChange('female')}
                  />
                </View>
              )}
            />
          </View>
        </View>

        {/* Height + Weight row */}
        <View className="mb-2.5 flex-row gap-2.5">
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
        <View className="mb-3">
          <Text className="mb-1 text-[10px] text-zinc-400 dark:text-zinc-600">
            Units
          </Text>
          <Controller
            control={control}
            name="units"
            render={({ field: { value, onChange } }) => (
              <View className="flex-row gap-1">
                <SegmentButton
                  label="Metric"
                  selected={value === 'metric'}
                  onPress={() => onChange('metric')}
                />
                <SegmentButton
                  label="Imperial"
                  selected={value === 'imperial'}
                  onPress={() => onChange('imperial')}
                />
              </View>
            )}
          />
        </View>

        {/* Live BMR result card */}
        {liveBmr !== null ? (
          <View className="mb-3">
            <Card variant="secondary" padding="md">
              <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Calculated BMR
              </Text>
              <Text className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
                {liveBmr.toLocaleString()} kcal / day
              </Text>
              <Text className="text-[10px] text-zinc-400 dark:text-zinc-500">
                Mifflin-St Jeor formula
              </Text>
            </Card>
          </View>
        ) : null}

        {submitError ? (
          <Text className="mb-2 text-[11px] text-brand-coral">
            {submitError}
          </Text>
        ) : null}

        {/* Continue CTA */}
        <View className="mt-auto pb-4">
          <Button
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Continue
          </Button>
        </View>
      </View>
    </ScreenLayout>
  )
}

// ─────────────────────────────────────────────
// Sub-component — a single segment in a toggle group.
// ─────────────────────────────────────────────

interface SegmentButtonProps {
  label: string
  selected: boolean
  onPress: () => void
}

function SegmentButton({
  label,
  selected,
  onPress,
}: SegmentButtonProps): React.ReactElement {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`flex-1 items-center justify-center rounded-lg px-3 py-2 ${
        selected
          ? 'bg-brand-green'
          : 'bg-zinc-50 dark:bg-zinc-800'
      }`}
    >
      <Text
        className={`text-[12px] font-medium ${
          selected ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
