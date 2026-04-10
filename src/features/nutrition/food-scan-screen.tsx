/**
 * src/features/nutrition/food-scan-screen.tsx
 *
 * Layer 2 — Food scan camera overlay screen.
 *
 * Presented as a full-screen modal on top of the Food tab. The user frames
 * their meal inside a centred viewfinder, taps the shutter, and the image
 * gets resized + compressed + base64-encoded for the confirm screen that
 * will be built in issue #35.
 *
 * Platform guard: `expo-camera` has limited/partial web support, so on web
 * we render a friendly mint-tinted fallback instead of attempting to mount
 * the native camera surface.
 *
 * The camera surface itself is deliberately a special case in the design
 * system — full-bleed black for a distraction-free viewfinder — but every
 * piece of surrounding chrome (top bar, bottom controls, fallback, permission
 * gate) follows the mint/Poppins aesthetic.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { CameraView } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Button } from '@components/ui/button'
import { useFoodCamera } from './use-food-camera'

const IS_WEB = Platform.OS === 'web'

// ═══════════════════════════════════════════════════════════════
// Root screen
// ═══════════════════════════════════════════════════════════════

export function FoodScanScreen(): React.ReactElement {
  if (IS_WEB) {
    return <WebFallback />
  }
  return <NativeFoodScan />
}

// ═══════════════════════════════════════════════════════════════
// Native camera UI (iOS / Android)
// ═══════════════════════════════════════════════════════════════

function NativeFoodScan(): React.ReactElement {
  const {
    cameraRef,
    permission,
    requestPermission,
    facing,
    toggleFacing,
    isCapturing,
    capture,
  } = useFoodCamera()

  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const flashAnim = useRef(new Animated.Value(0)).current

  const handleBack = useCallback((): void => {
    router.back()
  }, [])

  const handleCapture = useCallback(async (): Promise<void> => {
    if (isCapturing || isProcessing) return

    // Fire the shutter flash animation immediately for tactile feedback.
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start()

    setIsProcessing(true)
    try {
      const result = await capture()
      if (result) {
        // eslint-disable-next-line no-console
        console.log(
          '[food-scan] captured, base64 length:',
          result.base64.length,
        )
        // TODO(#35): router.push({ pathname: '/(tabs)/food/confirm', params: { ... } })
        router.back()
      }
    } finally {
      setIsProcessing(false)
    }
  }, [capture, flashAnim, isCapturing, isProcessing])

  // ─── Permission gate ─────────────────────────────────────────
  // `permission` is null on first render while the hook resolves.
  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#4FCFB8" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <PermissionGate
        canAskAgain={permission.canAskAgain}
        onRequest={requestPermission}
        onBack={handleBack}
      />
    )
  }

  const shutterDisabled = isCapturing || isProcessing

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />

      {/* ═══ Camera preview (fills screen) ═══ */}
      <CameraView
        ref={cameraRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        facing={facing}
      />

      {/* ═══ Viewfinder overlay ═══ */}
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <Viewfinder isProcessing={isProcessing} />
        <Text
          className="mt-7 font-sans-medium text-[13px] text-white/80"
          style={{ letterSpacing: 0.1 }}
        >
          Center the food in the frame
        </Text>
      </View>

      {/* ═══ Shutter flash ═══ */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          opacity: flashAnim,
        }}
      />

      {/* ═══ Top bar ═══ */}
      <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
        <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Close camera"
            hitSlop={10}
            className="active:opacity-70"
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-full bg-white"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Text
                className="font-sans-medium text-[20px] text-slate-900"
                style={{ marginTop: -2 }}
              >
                ←
              </Text>
            </View>
          </Pressable>

          <View className="rounded-full bg-black/40 px-4 py-2">
            <Text className="font-sans-semibold text-[12px] text-white">
              Scan food
            </Text>
          </View>

          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Log food manually"
            hitSlop={10}
            className="active:opacity-70"
          >
            <View className="rounded-full bg-white/15 px-4 py-2.5 backdrop-blur">
              <Text className="font-sans-semibold text-[12px] text-white">
                Manual
              </Text>
            </View>
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ═══ Bottom controls ═══ */}
      <SafeAreaView
        edges={['bottom']}
        className="absolute bottom-0 left-0 right-0"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
          locations={[0, 0.4]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View className="px-6 pb-4 pt-8">
          {/* Processing label sits above the shutter when active */}
          {isProcessing ? (
            <View className="mb-5 items-center">
              <View className="flex-row items-center gap-2 rounded-full bg-black/60 px-4 py-2">
                <ActivityIndicator size="small" color="#4FCFB8" />
                <Text className="font-sans-medium text-[13px] text-white">
                  Identifying food…
                </Text>
              </View>
            </View>
          ) : null}

          <View className="flex-row items-center justify-between">
            {/* Barcode mode pill (placeholder) */}
            <Pressable
              onPress={() => {
                // eslint-disable-next-line no-console
                console.log('[food-scan] barcode mode pressed')
              }}
              accessibilityRole="button"
              accessibilityLabel="Scan barcode"
              className="active:opacity-70"
              hitSlop={8}
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <Text className="font-sans-semibold text-[11px] text-white">
                  Scan
                </Text>
              </View>
            </Pressable>

            {/* Shutter */}
            <Pressable
              onPress={() => {
                void handleCapture()
              }}
              disabled={shutterDisabled}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              className={`active:opacity-90 ${
                shutterDisabled ? 'opacity-60' : ''
              }`}
              hitSlop={12}
            >
              <View
                className="h-[76px] w-[76px] items-center justify-center rounded-full bg-white"
                style={{
                  shadowColor: '#2BBF9E',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <View
                  className="h-[62px] w-[62px] rounded-full bg-white"
                  style={{ borderWidth: 3, borderColor: '#0A0F0D' }}
                />
              </View>
            </Pressable>

            {/* Flip camera */}
            <Pressable
              onPress={toggleFacing}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
              className="active:opacity-70"
              hitSlop={8}
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <Text
                  className="font-sans-semibold text-[18px] text-white"
                  style={{ marginTop: -1 }}
                >
                  ↺
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Viewfinder — rounded frame with mint corner brackets
// ═══════════════════════════════════════════════════════════════

interface ViewfinderProps {
  isProcessing: boolean
}

const VIEWFINDER_SIZE = 260
const CORNER_SIZE = 34
const CORNER_THICKNESS = 4
const CORNER_RADIUS = 18

function Viewfinder({ isProcessing }: ViewfinderProps): React.ReactElement {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1600,
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => {
      loop.stop()
    }
  }, [pulse])

  const cornerOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  })

  const cornerBase = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#7DD9B8', // mint-300
  }

  return (
    <View
      style={{
        width: VIEWFINDER_SIZE,
        height: VIEWFINDER_SIZE,
      }}
    >
      {/* Subtle dim around the viewfinder edge */}
      <View
        className="absolute inset-0 rounded-3xl"
        style={{
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
        }}
      />

      {/* Top-left */}
      <Animated.View
        style={[
          cornerBase,
          {
            top: -2,
            left: -2,
            borderTopWidth: CORNER_THICKNESS,
            borderLeftWidth: CORNER_THICKNESS,
            borderTopLeftRadius: CORNER_RADIUS,
            opacity: cornerOpacity,
          },
        ]}
      />
      {/* Top-right */}
      <Animated.View
        style={[
          cornerBase,
          {
            top: -2,
            right: -2,
            borderTopWidth: CORNER_THICKNESS,
            borderRightWidth: CORNER_THICKNESS,
            borderTopRightRadius: CORNER_RADIUS,
            opacity: cornerOpacity,
          },
        ]}
      />
      {/* Bottom-left */}
      <Animated.View
        style={[
          cornerBase,
          {
            bottom: -2,
            left: -2,
            borderBottomWidth: CORNER_THICKNESS,
            borderLeftWidth: CORNER_THICKNESS,
            borderBottomLeftRadius: CORNER_RADIUS,
            opacity: cornerOpacity,
          },
        ]}
      />
      {/* Bottom-right */}
      <Animated.View
        style={[
          cornerBase,
          {
            bottom: -2,
            right: -2,
            borderBottomWidth: CORNER_THICKNESS,
            borderRightWidth: CORNER_THICKNESS,
            borderBottomRightRadius: CORNER_RADIUS,
            opacity: cornerOpacity,
          },
        ]}
      />

      {/* Processing spinner overlay */}
      {isProcessing ? (
        <View className="absolute inset-0 items-center justify-center">
          <View
            className="h-20 w-20 items-center justify-center rounded-full bg-black/60"
            style={{
              shadowColor: '#2BBF9E',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
            }}
          >
            <ActivityIndicator size="large" color="#4FCFB8" />
          </View>
        </View>
      ) : null}
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Permission gate — friendly mint-tinted request screen
// ═══════════════════════════════════════════════════════════════

interface PermissionGateProps {
  canAskAgain: boolean
  onRequest: () => Promise<unknown>
  onBack: () => void
}

function PermissionGate({
  canAskAgain,
  onRequest,
  onBack,
}: PermissionGateProps): React.ReactElement {
  const handlePrimary = (): void => {
    if (canAskAgain) {
      void onRequest()
    } else {
      void Linking.openSettings()
    }
  }

  return (
    <View className="flex-1 bg-mint-100">
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 160, left: -80 }}
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6">
          <View className="pt-2">
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
              hitSlop={8}
            >
              <Text className="font-sans-medium text-[22px] text-slate-700">
                ←
              </Text>
            </Pressable>
          </View>

          <View className="flex-1" />

          <View className="items-center">
            <View
              className="h-28 w-28 items-center justify-center rounded-full bg-white"
              style={{
                shadowColor: '#1D9E75',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.18,
                shadowRadius: 24,
                elevation: 8,
              }}
            >
              <View className="h-20 w-20 items-center justify-center rounded-full bg-mint-400">
                <Text className="font-sans-bold text-[30px] text-white">
                  ◉
                </Text>
              </View>
            </View>
          </View>

          <View className="mt-8 items-center px-2">
            <Text
              className="text-center font-sans-bold text-[28px] text-slate-900"
              style={{ lineHeight: 34, letterSpacing: -0.5 }}
            >
              Camera access{'\n'}needed
            </Text>
            <Text
              className="mt-4 text-center font-sans text-[15px] text-slate-600"
              style={{ lineHeight: 22 }}
            >
              HealthOS needs your camera to scan meals and estimate
              their macros in seconds.
            </Text>
          </View>

          <View className="flex-1" />

          <View className="pb-4">
            <Button onPress={handlePrimary}>
              {canAskAgain ? 'Enable camera' : 'Open settings'}
            </Button>
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              className="mt-4 items-center active:opacity-60"
              hitSlop={8}
            >
              <Text className="font-sans-medium text-[13px] text-slate-500">
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Web fallback — mint-tinted explainer card
// ═══════════════════════════════════════════════════════════════

function WebFallback(): React.ReactElement {
  const handleBack = (): void => {
    router.back()
  }

  const handleManual = (): void => {
    // TODO(#35): route to manual entry once that screen exists.
    router.back()
  }

  return (
    <View className="flex-1 bg-mint-100">
      <StatusBar style="dark" />
      <LinearGradient
        colors={['#F0FBF7', '#D8F3E8', '#B5E8D5']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {/* Decorative soft circles */}
      <View
        className="absolute rounded-full bg-white/30"
        style={{ width: 280, height: 280, top: -80, right: -100 }}
      />
      <View
        className="absolute rounded-full bg-white/20"
        style={{ width: 200, height: 200, top: 180, left: -80 }}
      />

      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6">
          <View className="pt-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
              hitSlop={8}
            >
              <Text className="font-sans-medium text-[22px] text-slate-700">
                ←
              </Text>
            </Pressable>
          </View>

          <View className="flex-1" />

          <View
            className="rounded-3xl bg-white p-6"
            style={{
              shadowColor: '#1D9E75',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 24,
              elevation: 6,
            }}
          >
            <View className="items-center">
              <View
                className="h-24 w-24 items-center justify-center rounded-full bg-white"
                style={{
                  shadowColor: '#1D9E75',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.18,
                  shadowRadius: 18,
                  elevation: 6,
                }}
              >
                <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-400">
                  <Text className="font-sans-bold text-[24px] text-white">
                    ◉
                  </Text>
                </View>
              </View>
            </View>

            <Text
              className="mt-6 text-center font-sans-bold text-[24px] text-slate-900"
              style={{ lineHeight: 30, letterSpacing: -0.4 }}
            >
              Food scanning works{'\n'}on iOS and Android
            </Text>
            <Text
              className="mt-3 text-center font-sans text-[14px] text-slate-600"
              style={{ lineHeight: 21 }}
            >
              Use the camera in the HealthOS mobile app to scan meals.
              On the web, log your food manually instead.
            </Text>
          </View>

          <View className="flex-1" />

          <View className="gap-3 pb-4">
            <Button onPress={handleManual}>Add manually</Button>
            <Button variant="secondary" onPress={handleBack}>
              Go back
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
