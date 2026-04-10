/**
 * src/features/workout/session-logger.tsx
 *
 * Layer 4 — the active workout session logger screen (#48).
 *
 * Presented full-screen-modal over the Workout tab when the user taps
 * "Begin" on a day card. Shows a list of exercise cards in three visual
 * states (Done / Active / Upcoming), lets the user log each set inline,
 * runs a per-exercise rest timer, and persists everything through the
 * shared `use-session` hook.
 *
 * Visual language matches the rest of the app: flat white page surface
 * with rounded-3xl white cards separated by subtle slate borders. The
 * active exercise card keeps its mint border so it still reads as "now".
 * The primary "Log" CTA keeps a soft mint glow. Poppins typography,
 * generous whitespace tuned for a data-dense screen.
 *
 * This file is pure presentation. All state — session row, planned
 * exercises, logged sets, elapsed timer, active-exercise derivation — lives
 * in `useSession()`. The only mutation we drive from here is the confirm
 * dialog for leaving early + the local rest-timer tick.
 *
 * Hard rules: no `any`, no StyleSheet.create, no raw SQL, no logic in the
 * route file, Poppins only.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '@components/ui/button'
import type { SessionSet } from '@db/schema'
import { useSession, type ExerciseWithSets } from './use-session'

// ─────────────────────────────────────────────
// Primary mint CTA glow — the "log set" button still lifts off the flat
// card surfaces so the main action feels intentionally elevated.
// ─────────────────────────────────────────────

const MINT_PILL_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.3,
  shadowRadius: 14,
  elevation: 6,
} as const

// Hardcoded "current week" — tracked separately in #49 progressive overload.
const CURRENT_WEEK = 1

// Minimum width for a set cell. Keeps a row of cells aligned even when a
// long weight (e.g. "102.5kg") would otherwise push the grid unevenly.
const SET_CELL_MIN_WIDTH = 68

// ─────────────────────────────────────────────
// Route params
// ─────────────────────────────────────────────

function parseNumericParam(value: string | string[] | undefined): number | null {
  if (value == null) return null
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function SessionLogger(): React.ReactElement {
  const params = useLocalSearchParams<{ planId: string; dayId: string }>()
  const planId = parseNumericParam(params.planId)
  const dayId = parseNumericParam(params.dayId)

  const {
    data,
    loading,
    error,
    starting,
    isLogging,
    startOrResume,
    logActiveSet,
    finish,
    abandon,
  } = useSession()

  // Kick off the session on mount. If either param is missing we'll fall
  // through to the error state below.
  useEffect(() => {
    if (planId == null || dayId == null) return
    void startOrResume(planId, dayId)
  }, [planId, dayId, startOrResume])

  // Confirm before leaving mid-session.
  const confirmLeave = useCallback((): void => {
    if (data.session == null || data.isAllComplete) {
      // Nothing to lose — just close.
      abandon()
      router.back()
      return
    }
    Alert.alert(
      'End session early?',
      'Your logged sets will be kept and the session can be resumed later.',
      [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End session',
          style: 'destructive',
          onPress: () => {
            abandon()
            router.back()
          },
        },
      ],
    )
  }, [abandon, data.isAllComplete, data.session])

  // Intercept the Android hardware back button with the same confirmation.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmLeave()
      return true
    })
    return () => sub.remove()
  }, [confirmLeave])

  const handleFinish = useCallback(async (): Promise<void> => {
    await finish()
    router.replace('/(tabs)/workout')
  }, [finish])

  const handleLogSet = useCallback(
    async (weightKg: number | null, reps: number): Promise<void> => {
      await logActiveSet(weightKg, reps)
    },
    [logActiveSet],
  )

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (planId == null || dayId == null) {
    return (
      <Backdrop>
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <ErrorState
            title="Missing session info"
            message="We couldn't tell which day to start. Head back to the plan and tap Begin again."
            onBack={() => router.back()}
          />
        </SafeAreaView>
      </Backdrop>
    )
  }

  return (
    <Backdrop>
      <SafeAreaView edges={['top']} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          <TopBar
            dayName={data.session?.name ?? 'Workout'}
            week={CURRENT_WEEK}
            elapsedSeconds={data.elapsedSeconds}
            onClose={confirmLeave}
          />

          {loading || starting ? (
            <LoadingState />
          ) : error != null ? (
            <ErrorState
              title={errorTitle(error.kind)}
              message={error.message}
              onBack={() => {
                abandon()
                router.back()
              }}
            />
          ) : (
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 64,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <WeekProgressStrip
                weeksTotal={8}
                currentWeek={CURRENT_WEEK}
              />

              <View className="mt-6">
                {data.exercises.map((entry, idx) => {
                  const state: ExerciseState =
                    idx < data.activeExerciseIndex
                      ? 'done'
                      : idx === data.activeExerciseIndex
                        ? 'active'
                        : 'upcoming'
                  return (
                    <View
                      key={entry.exercise.id}
                      style={idx > 0 ? { marginTop: 14 } : undefined}
                    >
                      <ExerciseCard
                        entry={entry}
                        state={state}
                        onLog={handleLogSet}
                        isLogging={isLogging}
                      />
                    </View>
                  )
                })}
              </View>

              {data.isAllComplete ? (
                <View className="mt-8">
                  <FinishCard
                    onFinish={handleFinish}
                    isLogging={isLogging}
                  />
                </View>
              ) : null}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Backdrop>
  )
}

// ─────────────────────────────────────────────
// Backdrop — flat white surface. Kept as a wrapper so every branch of
// the session screen renders against the same calm page background.
// ─────────────────────────────────────────────

interface BackdropProps {
  children: React.ReactNode
}

function Backdrop({ children }: BackdropProps): React.ReactElement {
  return <View className="flex-1 bg-white">{children}</View>
}

// ─────────────────────────────────────────────
// Top bar — close button, centred day label, live session timer.
// ─────────────────────────────────────────────

interface TopBarProps {
  dayName: string
  week: number
  elapsedSeconds: number
  onClose: () => void
}

function TopBar({
  dayName,
  week,
  elapsedSeconds,
  onClose,
}: TopBarProps): React.ReactElement {
  return (
    <View className="flex-row items-center justify-between px-5 pt-2 pb-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End session"
        onPress={onClose}
        hitSlop={10}
        className="active:opacity-70"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white">
          <Text className="font-sans-medium text-[18px] text-slate-600">
            {'\u00D7'}
          </Text>
        </View>
      </Pressable>

      <View className="items-center">
        <Text className="font-sans-semibold text-[14px] text-slate-700">
          {dayName} {'\u00B7'} Week {week}
        </Text>
        <Text className="mt-0.5 font-sans text-[10px] text-slate-400">
          Session in progress
        </Text>
      </View>

      <View className="rounded-full border border-slate-100 bg-white px-3 py-1.5">
        <Text className="font-sans-bold text-[15px] text-mint-600">
          {formatElapsed(elapsedSeconds)}
        </Text>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Week progress strip — thin pills matching the pre-session view.
// ─────────────────────────────────────────────

interface WeekProgressStripProps {
  weeksTotal: number
  currentWeek: number
}

function WeekProgressStrip({
  weeksTotal,
  currentWeek,
}: WeekProgressStripProps): React.ReactElement {
  const segments = Array.from({ length: weeksTotal }, (_, i) => i + 1)
  return (
    <View className="flex-row gap-1">
      {segments.map((weekNum) => (
        <View
          key={weekNum}
          className={`h-1.5 flex-1 rounded-full ${
            weekNum <= currentWeek ? 'bg-mint-500' : 'bg-mint-100'
          }`}
        />
      ))}
    </View>
  )
}

// ─────────────────────────────────────────────
// Exercise card — dispatches on state.
// ─────────────────────────────────────────────

type ExerciseState = 'done' | 'active' | 'upcoming'

interface ExerciseCardProps {
  entry: ExerciseWithSets
  state: ExerciseState
  onLog: (weightKg: number | null, reps: number) => Promise<void>
  isLogging: boolean
}

function ExerciseCard({
  entry,
  state,
  onLog,
  isLogging,
}: ExerciseCardProps): React.ReactElement {
  if (state === 'done') return <DoneExerciseCard entry={entry} />
  if (state === 'active') {
    return (
      <ActiveExerciseCard
        entry={entry}
        onLog={onLog}
        isLogging={isLogging}
      />
    )
  }
  return <UpcomingExerciseCard entry={entry} />
}

// ─────────────────────────────────────────────
// Done card — exercise + logged sets grid + PR badge (placeholder for #49).
// ─────────────────────────────────────────────

interface DoneExerciseCardProps {
  entry: ExerciseWithSets
}

function DoneExerciseCard({
  entry,
}: DoneExerciseCardProps): React.ReactElement {
  const hasPr = entry.loggedSets.some((s) => s.isPr)

  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="font-sans-semibold text-[16px] text-slate-900"
            numberOfLines={2}
          >
            {entry.exercise.name}
          </Text>
          <Text className="mt-1 font-sans text-[11px] text-slate-400">
            {entry.loggedSets.length} {'\u00D7'} done
          </Text>
        </View>

        <View className="rounded-full bg-mint-100 px-3 py-1">
          <Text className="font-sans-semibold text-[11px] text-mint-700">
            Done
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <SetGrid entry={entry} activeSetIndex={null} />
      </View>

      {hasPr ? (
        <View className="mt-4 self-start rounded-full bg-mint-500 px-3 py-1">
          <Text className="font-sans-semibold text-[10px] text-white">
            + NEW PR
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// ─────────────────────────────────────────────
// Active card — full logging UI + rest timer + mint border.
// ─────────────────────────────────────────────

interface ActiveExerciseCardProps {
  entry: ExerciseWithSets
  onLog: (weightKg: number | null, reps: number) => Promise<void>
  isLogging: boolean
}

function ActiveExerciseCard({
  entry,
  onLog,
  isLogging,
}: ActiveExerciseCardProps): React.ReactElement {
  const { exercise, loggedSets } = entry
  const nextSetIndex = loggedSets.length // 0-based index of the set to log

  // Default the weight input to the plan's planned weight, or the weight
  // of the most recent logged set — gives the user a sensible starting
  // point they can tweak rather than typing from scratch every time.
  const defaultWeight = useMemo<string>(() => {
    const last = loggedSets[loggedSets.length - 1]
    if (last?.weightKg != null) return String(last.weightKg)
    if (exercise.weightKg != null) return String(exercise.weightKg)
    return ''
  }, [exercise.weightKg, loggedSets])

  const defaultReps = useMemo<string>(() => {
    const last = loggedSets[loggedSets.length - 1]
    if (last?.reps != null) return String(last.reps)
    return String(exercise.reps)
  }, [exercise.reps, loggedSets])

  const [weight, setWeight] = useState<string>(defaultWeight)
  const [reps, setReps] = useState<string>(defaultReps)
  const [weightError, setWeightError] = useState<boolean>(false)
  const [repsError, setRepsError] = useState<boolean>(false)

  // Re-seed inputs each time a set is logged (nextSetIndex changes).
  const lastSeededForSetRef = useRef<number>(-1)
  useEffect(() => {
    if (lastSeededForSetRef.current === nextSetIndex) return
    lastSeededForSetRef.current = nextSetIndex
    setWeight(defaultWeight)
    setReps(defaultReps)
    setWeightError(false)
    setRepsError(false)
  }, [nextSetIndex, defaultWeight, defaultReps])

  const handleLog = useCallback(async (): Promise<void> => {
    const parsedReps = Number.parseInt(reps, 10)
    const hasRepsError = !Number.isFinite(parsedReps) || parsedReps <= 0
    // Weight is optional — bodyweight exercises can log null.
    const trimmedWeight = weight.trim()
    let parsedWeight: number | null = null
    let hasWeightError = false
    if (trimmedWeight.length > 0) {
      const n = Number.parseFloat(trimmedWeight)
      if (!Number.isFinite(n) || n < 0) {
        hasWeightError = true
      } else {
        parsedWeight = n
      }
    }

    setWeightError(hasWeightError)
    setRepsError(hasRepsError)

    if (hasRepsError || hasWeightError) return
    await onLog(parsedWeight, parsedReps)
  }, [weight, reps, onLog])

  return (
    <View className="rounded-3xl border-2 border-mint-400 bg-white p-5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="font-sans-semibold text-[18px] text-slate-900"
            style={{ letterSpacing: -0.2 }}
            numberOfLines={2}
          >
            {exercise.name}
          </Text>
          <Text className="mt-1 font-sans text-[13px] text-slate-500">
            Target: {exercise.sets} {'\u00D7'} {exercise.reps} reps
            {exercise.tempo != null && exercise.tempo.length > 0
              ? ` \u00B7 ${exercise.tempo} tempo`
              : ''}
          </Text>
        </View>

        <View className="rounded-full bg-brand-amber/15 px-3 py-1">
          <Text className="font-sans-semibold text-[11px] text-brand-amber">
            Active
          </Text>
        </View>
      </View>

      <View className="mt-5">
        <SetGrid entry={entry} activeSetIndex={nextSetIndex} />
      </View>

      {/* Log inputs — show until the last set for this exercise is logged. */}
      <View className="mt-5 flex-row items-end gap-3">
        <NumericField
          label="Weight (kg)"
          value={weight}
          onChange={setWeight}
          placeholder="0"
          error={weightError}
          decimal
        />
        <NumericField
          label="Reps"
          value={reps}
          onChange={setReps}
          placeholder={String(exercise.reps)}
          error={repsError}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Log set ${nextSetIndex + 1}`}
          onPress={() => {
            void handleLog()
          }}
          disabled={isLogging}
          hitSlop={4}
          className={`active:opacity-85 ${isLogging ? 'opacity-60' : ''}`}
        >
          <View
            className="h-[52px] items-center justify-center rounded-2xl bg-mint-500 px-5"
            style={MINT_PILL_SHADOW}
          >
            <Text className="font-sans-semibold text-[13px] text-white">
              Log
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Rest timer: only show after at least one set is logged and
          the exercise isn't done yet (by definition of Active). */}
      {loggedSets.length > 0 ? (
        <View className="mt-4">
          <RestTimer
            key={`rest-${exercise.id}-${loggedSets.length}`}
            durationSeconds={exercise.restSeconds}
          />
        </View>
      ) : (
        <View className="mt-4 rounded-2xl bg-mint-50 px-4 py-3">
          <Text className="font-sans text-[12px] text-slate-500">
            {exercise.progressionNote != null &&
            exercise.progressionNote.length > 0
              ? exercise.progressionNote
              : 'Log your first set to start the rest timer.'}
          </Text>
        </View>
      )}
    </View>
  )
}

// ─────────────────────────────────────────────
// Upcoming card — collapsed preview at 70% opacity.
// ─────────────────────────────────────────────

interface UpcomingExerciseCardProps {
  entry: ExerciseWithSets
}

function UpcomingExerciseCard({
  entry,
}: UpcomingExerciseCardProps): React.ReactElement {
  const { exercise } = entry
  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-4 opacity-70">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="font-sans-semibold text-[14px] text-slate-700"
            numberOfLines={1}
          >
            {exercise.name}
          </Text>
          <Text className="mt-0.5 font-sans text-[12px] text-slate-400">
            {exercise.sets} {'\u00D7'} {exercise.reps} {'\u00B7'}{' '}
            {Math.round(exercise.restSeconds)}s rest
          </Text>
        </View>
        <View className="rounded-full bg-slate-100 px-3 py-1">
          <Text className="font-sans-medium text-[10px] text-slate-500">
            Next
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Set grid — shared by done + active cards.
// ─────────────────────────────────────────────

interface SetGridProps {
  entry: ExerciseWithSets
  /** 0-based index of the set currently being logged, or null if none. */
  activeSetIndex: number | null
}

function SetGrid({
  entry,
  activeSetIndex,
}: SetGridProps): React.ReactElement {
  const { exercise, loggedSets } = entry
  const plannedSets = Array.from(
    { length: Math.max(exercise.sets, loggedSets.length) },
    (_, i) => i,
  )

  return (
    <View className="flex-row flex-wrap gap-2">
      {plannedSets.map((idx) => {
        const logged: SessionSet | undefined = loggedSets[idx]
        if (logged != null) {
          return <LoggedSetCell key={idx} set={logged} index={idx} />
        }
        if (activeSetIndex === idx) {
          return (
            <ActiveSetCell
              key={idx}
              index={idx}
              plannedReps={exercise.reps}
            />
          )
        }
        return <PendingSetCell key={idx} index={idx} />
      })}
    </View>
  )
}

interface LoggedSetCellProps {
  set: SessionSet
  index: number
}

function LoggedSetCell({
  set,
  index,
}: LoggedSetCellProps): React.ReactElement {
  const weightLabel =
    set.weightKg != null ? `${formatWeight(set.weightKg)}kg` : 'BW'
  return (
    <View
      className="items-center rounded-2xl border border-mint-200 bg-mint-50 px-3 py-2"
      style={{ minWidth: SET_CELL_MIN_WIDTH }}
      accessibilityLabel={`Set ${index + 1}: ${weightLabel} for ${set.reps ?? 0} reps`}
    >
      <Text className="font-sans-semibold text-[14px] text-slate-900">
        {weightLabel}
      </Text>
      <Text className="mt-0.5 font-sans text-[11px] text-slate-500">
        {'\u00D7'} {set.reps ?? 0}
      </Text>
    </View>
  )
}

interface ActiveSetCellProps {
  index: number
  plannedReps: number
}

function ActiveSetCell({
  index,
  plannedReps,
}: ActiveSetCellProps): React.ReactElement {
  return (
    <View
      className="items-center rounded-2xl bg-mint-500 px-3 py-2"
      style={{
        minWidth: SET_CELL_MIN_WIDTH,
        ...MINT_PILL_SHADOW,
      }}
      accessibilityLabel={`Logging set ${index + 1}`}
    >
      <Text className="font-sans-bold text-[13px] text-white">
        Set {index + 1}
      </Text>
      <Text className="mt-0.5 font-sans-medium text-[11px] text-white/90">
        {'\u00D7'} {plannedReps}
      </Text>
    </View>
  )
}

interface PendingSetCellProps {
  index: number
}

function PendingSetCell({ index }: PendingSetCellProps): React.ReactElement {
  return (
    <View
      className="items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-2"
      style={{ minWidth: SET_CELL_MIN_WIDTH }}
    >
      <Text className="font-sans-medium text-[12px] text-slate-400">
        Set {index + 1}
      </Text>
      <Text className="mt-0.5 font-sans text-[10px] text-slate-300">
        pending
      </Text>
    </View>
  )
}

// ─────────────────────────────────────────────
// Numeric field — a compact input sized for the inline log row.
// Matches the `Input` component's visual language but is more compact.
// ─────────────────────────────────────────────

interface NumericFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: boolean
  decimal?: boolean
}

function NumericField({
  label,
  value,
  onChange,
  placeholder,
  error = false,
  decimal = false,
}: NumericFieldProps): React.ReactElement {
  return (
    <View className="flex-1">
      <Text className="mb-1.5 font-sans-medium text-[11px] text-slate-500">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#B6BCBC"
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        className={`h-[52px] rounded-2xl border bg-slate-50 px-4 font-sans-semibold text-[16px] text-slate-900 ${
          error ? 'border-brand-coral' : 'border-slate-100'
        }`}
      />
    </View>
  )
}

// ─────────────────────────────────────────────
// Rest timer — counts down from durationSeconds. Resets via its `key` prop
// whenever the parent re-mounts it (one logged set => one new key).
// ─────────────────────────────────────────────

interface RestTimerProps {
  durationSeconds: number
}

function RestTimer({
  durationSeconds,
}: RestTimerProps): React.ReactElement {
  const startedAtRef = useRef<number>(Date.now())
  const [now, setNow] = useState<number>(Date.now())
  const [skipped, setSkipped] = useState<boolean>(false)

  useEffect(() => {
    if (skipped) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [skipped])

  const elapsed = Math.max(
    0,
    Math.floor((now - startedAtRef.current) / 1000),
  )
  const remaining = Math.max(0, durationSeconds - elapsed)
  const isReady = remaining === 0 || skipped

  return (
    <View
      className={`rounded-2xl px-4 py-3 ${
        isReady ? 'bg-mint-100' : 'bg-mint-50'
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-sans-medium text-[11px] text-slate-500">
            {isReady ? 'Ready' : 'Rest'}
          </Text>
          <Text
            className={`mt-0.5 font-sans-semibold text-[14px] ${
              isReady ? 'text-mint-700' : 'text-slate-800'
            }`}
          >
            {isReady
              ? 'Ready for your next set'
              : formatRest(remaining)}
          </Text>
        </View>

        {!isReady ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Skip rest"
            onPress={() => setSkipped(true)}
            hitSlop={8}
            className="active:opacity-60"
          >
            <Text className="font-sans-medium text-[12px] text-mint-600">
              Skip {'\u2192'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Finish card — celebratory end-of-session CTA.
// ─────────────────────────────────────────────

interface FinishCardProps {
  onFinish: () => Promise<void>
  isLogging: boolean
}

function FinishCard({
  onFinish,
  isLogging,
}: FinishCardProps): React.ReactElement {
  const [pressed, setPressed] = useState<boolean>(false)

  const handle = useCallback(async (): Promise<void> => {
    setPressed(true)
    await onFinish()
  }, [onFinish])

  return (
    <View className="rounded-3xl border border-slate-100 bg-white p-6">
      <View className="items-center">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
          <Text className="font-sans-bold text-[28px] text-mint-600">
            {'\u2713'}
          </Text>
        </View>
        <Text
          className="mt-4 text-center font-sans-bold text-[20px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          All sets logged
        </Text>
        <Text
          className="mt-2 text-center font-sans text-[13px] text-slate-500"
          style={{ lineHeight: 19, maxWidth: 260 }}
        >
          Nice work — wrap the session to save it to your history.
        </Text>
      </View>
      <View className="mt-5">
        <Button
          onPress={() => {
            void handle()
          }}
          loading={isLogging || pressed}
        >
          Finish session
        </Button>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Loading + error states.
// ─────────────────────────────────────────────

function LoadingState(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center pb-24">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-slate-100 bg-white">
        <View className="h-6 w-6 rounded-full bg-mint-300" />
      </View>
      <Text className="mt-4 font-sans text-[13px] text-slate-500">
        Getting your session ready…
      </Text>
    </View>
  )
}

interface ErrorStateProps {
  title: string
  message: string
  onBack: () => void
}

function ErrorState({
  title,
  message,
  onBack,
}: ErrorStateProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full items-center rounded-3xl border border-slate-100 bg-white p-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
          <Text className="font-sans-bold text-[28px] text-mint-600">!</Text>
        </View>
        <Text
          className="mt-4 text-center font-sans-bold text-[20px] text-slate-900"
          style={{ letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        <Text
          className="mt-2 text-center font-sans text-[13px] text-slate-500"
          style={{ lineHeight: 19, maxWidth: 280 }}
        >
          {message}
        </Text>
        <View className="mt-6 w-full">
          <Button variant="secondary" onPress={onBack}>
            Back to workouts
          </Button>
        </View>
      </View>
    </View>
  )
}

// ─────────────────────────────────────────────
// Pure formatting helpers — kept local so the hook stays data-only.
// ─────────────────────────────────────────────

/**
 * Format the elapsed session timer as MM:SS (or HH:MM:SS once the user
 * crosses an hour, which shouldn't happen often in a normal workout).
 */
export function formatElapsed(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  const mm = m.toString().padStart(2, '0')
  const ss = s.toString().padStart(2, '0')
  if (h > 0) {
    return `${h}:${mm}:${ss}`
  }
  return `${mm}:${ss}`
}

/**
 * Format a rest countdown as M:SS — no leading hour, no padding on minutes.
 * 90 → "1:30", 45 → "0:45", 0 → "0:00".
 */
export function formatRest(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Format a weight value as a short human string — strips trailing ".0"
 * so `42.5` renders as "42.5" and `42` renders as "42".
 */
export function formatWeight(kg: number): string {
  if (!Number.isFinite(kg)) return '0'
  if (Number.isInteger(kg)) return kg.toString()
  return kg.toFixed(1).replace(/\.0$/, '')
}

function errorTitle(kind: 'no-profile' | 'no-exercises' | 'not-found' | 'unknown'): string {
  switch (kind) {
    case 'no-profile':
      return 'Profile needed'
    case 'no-exercises':
      return 'No exercises yet'
    case 'not-found':
      return "Couldn't find session"
    case 'unknown':
      return 'Something went wrong'
  }
}
