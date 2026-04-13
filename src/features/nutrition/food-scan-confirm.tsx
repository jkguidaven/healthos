/**
 * src/features/nutrition/food-scan-confirm.tsx
 *
 * Layer 2 — Food scan confirm screen.
 *
 * This is the screen that slides up after the user captures a photo in the
 * food-scan camera and Gemini has analysed it. The user reviews the result
 * (name, macros, confidence), optionally edits the values, picks a portion
 * multiplier + meal slot, and logs it to the food diary.
 *
 * Data handoff: the camera screen puts the scan result + base64 preview
 * into `useScanStore()` *before* navigating here. On mount we snapshot the
 * result into local state so the user can edit freely without fighting the
 * store. On successful save we clear the store and dismiss back to the food
 * log tab.
 *
 * Pure presentation + light orchestration — all side effects are delegated
 * to `useFoodScanner().save()` which owns the Drizzle write.
 *
 * Hard rules honoured:
 *   - No `any`, no raw SQL, no direct AI fetch
 *   - NativeWind Tailwind classes only, Poppins typography only
 *   - Flat white page surface with `rounded-3xl` cards separated by a
 *     subtle slate border. Mint stays as an accent colour on confidence
 *     pills, selected selectors, the primary CTA, and progress bars.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { Button } from '@components/ui/button'
import { MacroBar } from '@components/ui/macro-bar'
import type { FoodScanResult } from '@ai/prompts/food-scan'
import { useScanStore, type ScanSource } from '@/stores/scan-store'
import { useFoodScanner, type ScannedFoodMeal } from './use-food-scanner'

// ═══════════════════════════════════════════════════════════════
// Types & constants
// ═══════════════════════════════════════════════════════════════

type Portion = 0.5 | 1 | 1.5 | 2

const PORTIONS: readonly Portion[] = [0.5, 1, 1.5, 2] as const

interface MealOption {
  value: ScannedFoodMeal
  label: string
}

const MEAL_OPTIONS: readonly MealOption[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const

/**
 * Pick a sensible default meal based on the current hour.
 *  - breakfast: before 11:00
 *  - lunch:     11:00 – 14:59
 *  - dinner:    15:00 – 20:59
 *  - snack:     otherwise (late night / early morning)
 */
function defaultMealForNow(now: Date = new Date()): ScannedFoodMeal {
  const hour = now.getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

// ═══════════════════════════════════════════════════════════════
// Root screen
// ═══════════════════════════════════════════════════════════════

export function FoodScanConfirmScreen(): React.ReactElement {
  const storedResult = useScanStore((s) => s.result)
  const storedBase64 = useScanStore((s) => s.imageBase64)
  const storedMimeType = useScanStore((s) => s.imageMimeType)
  const storedSource = useScanStore((s) => s.source)
  const setScan = useScanStore((s) => s.setScan)
  const clearScan = useScanStore((s) => s.clear)

  if (!storedResult) {
    return <EmptyState />
  }

  return (
    <LoadedConfirm
      initialResult={storedResult}
      imageBase64={storedBase64}
      imageMimeType={storedMimeType}
      source={storedSource}
      setScan={setScan}
      onClear={clearScan}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// Loaded state — the real confirm UI
// ═══════════════════════════════════════════════════════════════

interface LoadedConfirmProps {
  initialResult: FoodScanResult
  imageBase64: string | null
  imageMimeType: 'image/jpeg' | 'image/png' | 'image/webp' | null
  source: ScanSource
  setScan: (
    result: FoodScanResult,
    imageBase64?: string | null,
    imageMimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | null,
    source?: ScanSource,
  ) => void
  onClear: () => void
}

function LoadedConfirm({
  initialResult,
  imageBase64,
  imageMimeType,
  source,
  setScan,
  onClear,
}: LoadedConfirmProps): React.ReactElement {
  const {
    save,
    isSaving,
    saveError,
    saveSuccess,
    scan,
    isScanning,
    scanError,
  } = useFoodScanner()

  const [edited, setEdited] = useState<FoodScanResult>(initialResult)
  const [portion, setPortion] = useState<Portion>(1)
  const [meal, setMeal] = useState<ScannedFoodMeal>(() => defaultMealForNow())
  const [editMode, setEditMode] = useState<boolean>(false)
  const [contextHint, setContextHint] = useState<string>('')

  // ─── Success flourish ────────────────────────────────────────
  // After a successful save we briefly show a check mark before
  // dismissing the modal and clearing the scan store.
  const checkAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!saveSuccess) return
    Animated.spring(checkAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start()

    const timer = setTimeout(() => {
      onClear()
      router.replace('/(tabs)/food')
    }, 650)

    return () => clearTimeout(timer)
  }, [saveSuccess, checkAnim, onClear])

  // ─── Handlers ────────────────────────────────────────────────
  const handleBack = useCallback((): void => {
    router.back()
  }, [])

  const handleRetake = useCallback((): void => {
    onClear()
    router.back()
  }, [onClear])

  const handleSave = useCallback((): void => {
    void save({ result: edited, meal, portion })
  }, [save, edited, meal, portion])

  const canRescan =
    source === 'ai'
    && imageBase64 !== null
    && imageMimeType !== null
    && contextHint.trim().length > 0
    && !isScanning
    && !isSaving

  const handleRescan = useCallback((): void => {
    if (!imageBase64 || !imageMimeType) return
    const hint = contextHint.trim()
    if (!hint) return
    void (async () => {
      try {
        const next = await scan({
          imageBase64,
          mimeType: imageMimeType,
          mealContext: meal,
          userContext: hint,
        })
        setEdited(next)
        setScan(next, imageBase64, imageMimeType, 'ai')
      } catch {
        // scanError is surfaced via the hook; the card shows it inline.
      }
    })()
  }, [imageBase64, imageMimeType, contextHint, scan, meal, setScan])

  const toggleEditMode = useCallback((): void => {
    setEditMode((prev) => !prev)
  }, [])

  // ─── Derived macros after portion multiplier ─────────────────
  const scaled = useMemo(() => {
    return {
      calories: Math.round(edited.calories * portion),
      protein: Math.round(edited.protein_g * portion * 10) / 10,
      carbs: Math.round(edited.carbs_g * portion * 10) / 10,
      fat: Math.round(edited.fat_g * portion * 10) / 10,
    }
  }, [edited, portion])

  // ─── Image preview URI ───────────────────────────────────────
  const previewUri = useMemo<string | null>(() => {
    if (!imageBase64) return null
    const mime = imageMimeType ?? 'image/jpeg'
    return `data:${mime};base64,${imageBase64}`
  }, [imageBase64, imageMimeType])

  const saveErrorMessage = useMemo<string | null>(() => {
    if (!saveError) return null
    return saveError.message || 'Couldn\u2019t save this meal. Try again.'
  }, [saveError])

  const rescanErrorMessage = useMemo<string | null>(() => {
    if (!scanError) return null
    return scanError.message || 'Couldn\u2019t rescan with that context. Try again.'
  }, [scanError])

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          {/* ═══ Top bar ═══ */}
          <View className="flex-row items-center justify-between px-5 pb-2 pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Close confirm"
              hitSlop={10}
              className="active:opacity-60"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white">
                <Text
                  className="font-sans-medium text-[20px] text-slate-700"
                  style={{ marginTop: -2 }}
                >
                  ←
                </Text>
              </View>
            </Pressable>

            <Text className="font-sans-semibold text-[17px] text-slate-900">
              Confirm scan
            </Text>

            {/* Spacer for balance */}
            <View className="h-10 w-10" />
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 28,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ═══ Photo thumbnail card ═══ */}
            <PhotoCard
              previewUri={previewUri}
              confidence={edited.confidence}
            />

            {/* ═══ Food name + edit toggle ═══ */}
            <View className="mt-6 flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                {editMode ? (
                  <TextInput
                    value={edited.name}
                    onChangeText={(value) =>
                      setEdited((prev) => ({ ...prev, name: value }))
                    }
                    placeholder="Food name"
                    placeholderTextColor="#8A9494"
                    className="rounded-2xl border border-mint-300 bg-white px-4 py-3 font-sans-bold text-[22px] text-slate-900"
                    maxLength={60}
                  />
                ) : (
                  <Text
                    className="font-sans-bold text-[24px] text-slate-900"
                    style={{ lineHeight: 30, letterSpacing: -0.4 }}
                  >
                    {edited.name}
                  </Text>
                )}
                <Text className="mt-1 font-sans text-[13px] text-slate-500">
                  {edited.serving_description}
                </Text>
              </View>

              <Pressable
                onPress={toggleEditMode}
                accessibilityRole="button"
                accessibilityLabel={editMode ? 'Done editing' : 'Edit values'}
                className="active:opacity-70"
                hitSlop={8}
              >
                <View
                  className={`rounded-full px-4 py-2 ${
                    editMode
                      ? 'bg-mint-500'
                      : 'border border-slate-100 bg-white'
                  }`}
                >
                  <Text
                    className={`font-sans-semibold text-[12px] ${
                      editMode ? 'text-white' : 'text-mint-700'
                    }`}
                  >
                    {editMode ? 'Done' : 'Edit values'}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* ═══ Macro grid card ═══ */}
            <View className="mt-5 rounded-3xl border border-slate-100 bg-white p-5">
              <View className="flex-row">
                <MacroCell
                  label="Calories"
                  unit="kcal"
                  valueColor="text-slate-900"
                  rawValue={edited.calories}
                  scaledValue={scaled.calories}
                  editMode={editMode}
                  onChange={(n) =>
                    setEdited((prev) => ({ ...prev, calories: n }))
                  }
                  integer
                />
                <CellDivider />
                <MacroCell
                  label="Protein"
                  unit="g"
                  valueColor="text-mint-600"
                  rawValue={edited.protein_g}
                  scaledValue={scaled.protein}
                  editMode={editMode}
                  onChange={(n) =>
                    setEdited((prev) => ({ ...prev, protein_g: n }))
                  }
                />
              </View>

              <View
                className="my-4 h-px w-full"
                style={{ backgroundColor: '#E6F4EE' }}
              />

              <View className="flex-row">
                <MacroCell
                  label="Carbs"
                  unit="g"
                  valueColor="text-slate-700"
                  rawValue={edited.carbs_g}
                  scaledValue={scaled.carbs}
                  editMode={editMode}
                  onChange={(n) =>
                    setEdited((prev) => ({ ...prev, carbs_g: n }))
                  }
                />
                <CellDivider />
                <MacroCell
                  label="Fat"
                  unit="g"
                  valueColor="text-slate-700"
                  rawValue={edited.fat_g}
                  scaledValue={scaled.fat}
                  editMode={editMode}
                  onChange={(n) =>
                    setEdited((prev) => ({ ...prev, fat_g: n }))
                  }
                />
              </View>

              <View className="mt-5">
                <MacroBar
                  proteinG={scaled.protein}
                  carbsG={scaled.carbs}
                  fatG={scaled.fat}
                  height={10}
                  showGrams
                />
              </View>
            </View>

            {/* ═══ Context / rescan card (AI scans only) ═══ */}
            {source === 'ai' && imageBase64 ? (
              <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
                <Text className="font-sans-semibold text-[13px] text-slate-900">
                  Not quite right?
                </Text>
                <Text className="mt-1 font-sans text-[12px] text-slate-500">
                  Tell us what this actually is — dish, ingredients, portion —
                  and we{'\u2019'}ll recompute the macros.
                </Text>

                <TextInput
                  value={contextHint}
                  onChangeText={setContextHint}
                  placeholder="e.g. chicken adobo, ~2 cups, cooked in soy & vinegar"
                  placeholderTextColor="#8A9494"
                  multiline
                  editable={!isScanning}
                  className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 font-sans-medium text-[14px] text-slate-900"
                  style={{ minHeight: 64, textAlignVertical: 'top' }}
                  maxLength={300}
                />

                {rescanErrorMessage ? (
                  <Text className="mt-2 font-sans-medium text-[12px] text-brand-coral">
                    {rescanErrorMessage}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleRescan}
                  disabled={!canRescan}
                  accessibilityRole="button"
                  accessibilityLabel="Rescan with context"
                  accessibilityState={{ disabled: !canRescan, busy: isScanning }}
                  className={`mt-3 self-start rounded-full px-5 py-2.5 active:opacity-80 ${
                    canRescan ? 'bg-mint-500' : 'bg-slate-100'
                  }`}
                >
                  {isScanning ? (
                    <View className="flex-row items-center gap-2">
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text className="font-sans-semibold text-[13px] text-white">
                        Rescanning…
                      </Text>
                    </View>
                  ) : (
                    <Text
                      className={`font-sans-semibold text-[13px] ${
                        canRescan ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      Rescan with context
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {/* ═══ Portion card ═══ */}
            <SelectorCard label="Portion">
              <View className="flex-row gap-2">
                {PORTIONS.map((p) => {
                  const selected = p === portion
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setPortion(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`Portion ${p}x`}
                      accessibilityState={{ selected }}
                      className="flex-1 active:opacity-80"
                    >
                      <View
                        className={`items-center justify-center rounded-full py-2.5 ${
                          selected ? 'bg-mint-500' : 'bg-slate-50'
                        }`}
                      >
                        <Text
                          className={`font-sans-semibold text-[13px] ${
                            selected ? 'text-white' : 'text-slate-600'
                          }`}
                        >
                          {p}×
                        </Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            </SelectorCard>

            {/* ═══ Meal card ═══ */}
            <SelectorCard label="Meal">
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {MEAL_OPTIONS.map((option) => {
                  const selected = option.value === meal
                  return (
                    <View
                      key={option.value}
                      className="py-1"
                      style={{ width: '50%', paddingHorizontal: 4 }}
                    >
                      <Pressable
                        onPress={() => setMeal(option.value)}
                        accessibilityRole="button"
                        accessibilityLabel={`Meal ${option.label}`}
                        accessibilityState={{ selected }}
                        className="active:opacity-80"
                      >
                        <View
                          className={`items-center justify-center rounded-full py-2.5 ${
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
                        </View>
                      </Pressable>
                    </View>
                  )
                })}
              </View>
            </SelectorCard>

            {/* ═══ Error row ═══ */}
            {saveErrorMessage ? (
              <View className="mt-5 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <Text className="font-sans-medium text-[13px] text-brand-coral">
                  {saveErrorMessage}
                </Text>
              </View>
            ) : null}

            {/* ═══ Actions ═══ */}
            <View className="mt-6 flex-row gap-3">
              <View className="flex-1">
                <Button variant="secondary" onPress={handleRetake}>
                  Retake
                </Button>
              </View>
              <View className="flex-1">
                <SavePrimaryButton
                  onPress={handleSave}
                  isSaving={isSaving}
                  saveSuccess={saveSuccess}
                  checkAnim={checkAnim}
                />
              </View>
            </View>

            <Text className="mt-4 text-center font-sans text-[11px] text-slate-500">
              Gemini identified this as {edited.name.toLowerCase()} with{' '}
              {edited.confidence} confidence.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Photo thumbnail card
// ═══════════════════════════════════════════════════════════════

interface PhotoCardProps {
  previewUri: string | null
  confidence: FoodScanResult['confidence']
}

function PhotoCard({
  previewUri,
  confidence,
}: PhotoCardProps): React.ReactElement {
  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-4">
      <View
        className="overflow-hidden rounded-2xl bg-mint-50"
        style={{ height: 200 }}
      >
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessibilityLabel="Scanned food photo"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-200">
              <Text className="font-sans-bold text-[22px] text-mint-700">
                ◉
              </Text>
            </View>
            <Text className="mt-3 font-sans-medium text-[12px] text-slate-500">
              No preview available
            </Text>
          </View>
        )}

        {/* Confidence badge overlaid bottom-right */}
        <View className="absolute bottom-3 right-3">
          <ConfidencePill confidence={confidence} />
        </View>
      </View>
    </View>
  )
}

interface ConfidencePillProps {
  confidence: FoodScanResult['confidence']
}

function ConfidencePill({
  confidence,
}: ConfidencePillProps): React.ReactElement {
  const config = useMemo(() => {
    if (confidence === 'high') {
      return { bg: 'bg-mint-500', label: 'High confidence' }
    }
    if (confidence === 'medium') {
      return { bg: 'bg-brand-amber', label: 'Medium confidence' }
    }
    return { bg: 'bg-brand-coral', label: 'Low confidence' }
  }, [confidence])

  return (
    <View
      className={`rounded-full px-3 py-1.5 ${config.bg}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 6,
      }}
    >
      <Text className="font-sans-semibold text-[11px] text-white">
        {config.label}
      </Text>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Macro cell
// ═══════════════════════════════════════════════════════════════

interface MacroCellProps {
  label: string
  unit: string
  valueColor: string
  rawValue: number
  scaledValue: number
  editMode: boolean
  onChange: (value: number) => void
  integer?: boolean
}

function MacroCell({
  label,
  unit,
  valueColor,
  rawValue,
  scaledValue,
  editMode,
  onChange,
  integer = false,
}: MacroCellProps): React.ReactElement {
  const handleChange = useCallback(
    (text: string): void => {
      const cleaned = text.replace(/[^0-9.]/g, '')
      if (cleaned === '') {
        onChange(0)
        return
      }
      const parsed = Number(cleaned)
      if (!Number.isFinite(parsed)) return
      onChange(integer ? Math.round(parsed) : parsed)
    },
    [onChange, integer],
  )

  return (
    <View className="flex-1 items-center">
      <Text className="font-sans-medium text-[11px] uppercase text-slate-400">
        {label}
      </Text>
      {editMode ? (
        <TextInput
          value={String(rawValue)}
          onChangeText={handleChange}
          keyboardType="decimal-pad"
          className={`mt-1.5 w-20 rounded-xl border border-mint-300 bg-white py-1.5 text-center font-sans-bold text-[18px] ${valueColor}`}
          selectTextOnFocus
        />
      ) : (
        <Text
          className={`mt-1.5 font-sans-bold text-[22px] ${valueColor}`}
          style={{ letterSpacing: -0.3 }}
        >
          {integer ? Math.round(scaledValue) : scaledValue}
        </Text>
      )}
      <Text className="mt-0.5 font-sans text-[10px] text-slate-400">
        {unit}
      </Text>
    </View>
  )
}

function CellDivider(): React.ReactElement {
  return (
    <View
      className="mx-1"
      style={{ width: 1, backgroundColor: '#E6F4EE' }}
    />
  )
}

// ═══════════════════════════════════════════════════════════════
// Selector card (portion / meal)
// ═══════════════════════════════════════════════════════════════

interface SelectorCardProps {
  label: string
  children: React.ReactNode
}

function SelectorCard({
  label,
  children,
}: SelectorCardProps): React.ReactElement {
  return (
    <View className="mt-4 rounded-3xl border border-slate-100 bg-white p-5">
      <Text className="mb-3 font-sans-medium text-[12px] text-slate-500">
        {label}
      </Text>
      {children}
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Save button — primary CTA with loading + success check flourish
// ═══════════════════════════════════════════════════════════════

interface SavePrimaryButtonProps {
  onPress: () => void
  isSaving: boolean
  saveSuccess: boolean
  checkAnim: Animated.Value
}

function SavePrimaryButton({
  onPress,
  isSaving,
  saveSuccess,
  checkAnim,
}: SavePrimaryButtonProps): React.ReactElement {
  const isDisabled = isSaving || saveSuccess

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Log this meal"
      accessibilityState={{ disabled: isDisabled, busy: isSaving }}
      disabled={isDisabled}
      onPress={onPress}
      className={`w-full rounded-full bg-mint-500 py-5 active:opacity-90 ${
        isDisabled && !saveSuccess ? 'opacity-70' : ''
      }`}
      style={{
        shadowColor: '#2BBF9E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      <View className="items-center justify-center">
        {saveSuccess ? (
          <Animated.View
            style={{
              transform: [{ scale: checkAnim }],
            }}
          >
            <Text className="font-sans-bold text-[20px] text-white">✓</Text>
          </Animated.View>
        ) : isSaving ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className="font-sans-semibold text-[15px] text-white">
            Log this meal
          </Text>
        )}
      </View>
    </Pressable>
  )
}

// ═══════════════════════════════════════════════════════════════
// Empty state — nothing to review
// ═══════════════════════════════════════════════════════════════

function EmptyState(): React.ReactElement {
  const handleBack = useCallback((): void => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace('/(tabs)/food')
  }, [])

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-24 w-24 items-center justify-center rounded-full border border-slate-100 bg-white">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-400">
              <Text className="font-sans-bold text-[24px] text-white">?</Text>
            </View>
          </View>

          <Text
            className="mt-8 text-center font-sans-bold text-[24px] text-slate-900"
            style={{ lineHeight: 30, letterSpacing: -0.4 }}
          >
            No scan to review
          </Text>
          <Text
            className="mt-3 text-center font-sans text-[14px] text-slate-600"
            style={{ lineHeight: 21 }}
          >
            Capture a meal from the camera and we{'\u2019'}ll bring you right
            back here to confirm the details.
          </Text>

          <View className="mt-10 w-full">
            <Button onPress={handleBack}>Go back</Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
