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
import { CameraView, type BarcodeScanningResult } from 'expo-camera'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Button } from '@components/ui/button'
import { useScanStore } from '@/stores/scan-store'
import {
  BarcodeNotFoundError,
  BarcodeNetworkError,
} from '@/lib/external/open-food-facts'
import { useBarcodeScanner } from './use-barcode-scanner'
import { useFoodCamera } from './use-food-camera'
import { useFoodScanner } from './use-food-scanner'

/** Which mode the camera is in — photo (AI vision) or barcode (OFF lookup). */
type ScanMode = 'photo' | 'barcode'

/**
 * Barcode formats we support. These are the standard product barcodes
 * you'll find on packaged food worldwide — EAN-13 (most countries), EAN-8
 * (short-form), UPC-A (US/Canada), UPC-E (short-form UPC). We deliberately
 * exclude QR codes, Data Matrix, and other non-product formats.
 */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const

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

  const { scan, isScanning, scanError, reset: resetScanner } = useFoodScanner()
  const {
    scan: lookupBarcodeScan,
    isScanning: isLookingUpBarcode,
    scanError: barcodeScanError,
    reset: resetBarcodeScanner,
  } = useBarcodeScanner()
  const setScan = useScanStore((s) => s.setScan)

  const [mode, setMode] = useState<ScanMode>('photo')
  const [localScanError, setLocalScanError] = useState<Error | null>(null)
  const flashAnim = useRef(new Animated.Value(0)).current

  // `expo-camera` fires onBarcodeScanned repeatedly (every frame) while a
  // barcode is visible. This ref tracks the code we've already committed
  // to so we only kick off one OFF lookup per scan session.
  const handledBarcodeRef = useRef<string | null>(null)

  // Any time the user returns to the camera after an error, clear the
  // sticky scanner error so a fresh capture starts from a clean slate.
  const clearError = useCallback((): void => {
    setLocalScanError(null)
    resetScanner()
    resetBarcodeScanner()
    handledBarcodeRef.current = null
  }, [resetScanner, resetBarcodeScanner])

  const handleBack = useCallback((): void => {
    clearError()
    router.back()
  }, [clearError])

  const handleToggleMode = useCallback((): void => {
    // Switching modes should clear any pending error from the other mode
    // so the user starts fresh.
    setLocalScanError(null)
    resetScanner()
    resetBarcodeScanner()
    handledBarcodeRef.current = null
    setMode((prev) => (prev === 'photo' ? 'barcode' : 'photo'))
  }, [resetScanner, resetBarcodeScanner])

  const handleBarcodeScanned = useCallback(
    (event: BarcodeScanningResult): void => {
      // Only act in barcode mode, and guard against expo-camera's repeated
      // callbacks for the same frame.
      if (mode !== 'barcode') return
      if (isLookingUpBarcode) return
      const code = event.data?.trim()
      if (!code) return
      if (handledBarcodeRef.current === code) return
      handledBarcodeRef.current = code

      setLocalScanError(null)

      void (async () => {
        try {
          const result = await lookupBarcodeScan(code)
          // Barcode flow carries no captured image — the confirm screen
          // will render a different visual treatment for barcode scans.
          setScan(result, null, null, 'barcode')
          router.push('/(tabs)/food/confirm')
        } catch (err) {
          // Reset the "already handled" guard so the user can try a
          // different barcode (or the same one after retry).
          handledBarcodeRef.current = null
          if (
            err instanceof BarcodeNotFoundError ||
            err instanceof BarcodeNetworkError
          ) {
            setLocalScanError(err)
          } else {
            setLocalScanError(
              err instanceof Error ? err : new Error('Barcode lookup failed'),
            )
          }
        }
      })()
    },
    [mode, isLookingUpBarcode, lookupBarcodeScan, setScan],
  )

  const handleCapture = useCallback(async (): Promise<void> => {
    if (mode !== 'photo') return
    if (isCapturing || isScanning) return

    setLocalScanError(null)

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

    const captured = await capture()
    if (!captured) return

    try {
      const result = await scan({
        imageBase64: captured.base64,
        mimeType: captured.mimeType,
      })
      setScan(result, captured.base64, captured.mimeType)
      router.push('/(tabs)/food/confirm')
    } catch (err) {
      // React Query already stores this in `scanError`, but we mirror it
      // into local state so the error overlay reacts immediately without
      // waiting for a re-render of the mutation hook.
      setLocalScanError(err instanceof Error ? err : new Error('Scan failed'))
    }
  }, [capture, flashAnim, isCapturing, isScanning, mode, scan, setScan])

  const isProcessing = isScanning || isLookingUpBarcode
  const activeError = localScanError ?? scanError ?? barcodeScanError

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
        barcodeScannerSettings={
          mode === 'barcode' ? { barcodeTypes: [...BARCODE_TYPES] } : undefined
        }
        onBarcodeScanned={
          mode === 'barcode' ? handleBarcodeScanned : undefined
        }
      />

      {/* ═══ Viewfinder overlay ═══ */}
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        <Viewfinder isProcessing={isProcessing} mode={mode} />
        <Text
          className="mt-7 font-sans-medium text-[13px] text-white/80"
          style={{ letterSpacing: 0.1 }}
        >
          {mode === 'photo'
            ? 'Center the food in the frame'
            : 'Point at a barcode'}
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

      {/* ═══ Scan error overlay ═══ */}
      {activeError && !isProcessing ? (
        <ScanErrorOverlay error={activeError} onDismiss={clearError} />
      ) : null}

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
                  {mode === 'photo'
                    ? 'Identifying food…'
                    : 'Looking up product…'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* ─── Mode segmented control ─── */}
          <View className="mb-6 items-center">
            <View
              className="flex-row rounded-full bg-black/45 p-1"
              style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <ModePill
                label="Photo"
                active={mode === 'photo'}
                onPress={() => {
                  if (mode !== 'photo') handleToggleMode()
                }}
                accessibilityLabel="Photo scan mode"
              />
              <ModePill
                label="Barcode"
                active={mode === 'barcode'}
                onPress={() => {
                  if (mode !== 'barcode') handleToggleMode()
                }}
                accessibilityLabel="Barcode scan mode"
              />
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            {/* Left slot — barcode hint in barcode mode, spacer otherwise */}
            {mode === 'barcode' ? (
              <View
                className="h-14 w-14 items-center justify-center rounded-full"
                style={{ backgroundColor: 'rgba(77, 179, 255, 0.18)' }}
              >
                <Text className="font-sans-bold text-[18px] text-white">
                  ≣
                </Text>
              </View>
            ) : (
              <View className="h-14 w-14" />
            )}

            {/* Shutter — only shown in photo mode. In barcode mode a
                friendly auto-scan indicator sits in its place. */}
            {mode === 'photo' ? (
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
            ) : (
              <View
                className="h-[76px] items-center justify-center rounded-full bg-black/55 px-6"
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(125, 217, 184, 0.45)',
                }}
              >
                <Text className="font-sans-semibold text-[13px] text-white">
                  Auto scanning
                </Text>
                <Text
                  className="mt-0.5 font-sans text-[11px] text-white/70"
                >
                  Hold steady
                </Text>
              </View>
            )}

            {/* Flip camera (photo mode only) */}
            {mode === 'photo' ? (
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
            ) : (
              <View className="h-14 w-14" />
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════
// Mode pill — segmented control between Photo and Barcode
// ═══════════════════════════════════════════════════════════════

interface ModePillProps {
  label: string
  active: boolean
  onPress: () => void
  accessibilityLabel: string
}

function ModePill({
  label,
  active,
  onPress,
  accessibilityLabel,
}: ModePillProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      className="active:opacity-80"
      hitSlop={6}
    >
      <View
        className={`rounded-full px-5 py-2 ${
          active ? 'bg-mint-400' : 'bg-transparent'
        }`}
        style={
          active
            ? {
                shadowColor: '#2BBF9E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 12,
                elevation: 4,
              }
            : undefined
        }
      >
        <Text
          className={`font-sans-semibold text-[12px] ${
            active ? 'text-white' : 'text-white/75'
          }`}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}

// ═══════════════════════════════════════════════════════════════
// Viewfinder — rounded frame with mint corner brackets
// ═══════════════════════════════════════════════════════════════

interface ViewfinderProps {
  isProcessing: boolean
  mode: ScanMode
}

const VIEWFINDER_SIZE = 260
const BARCODE_VIEWFINDER_HEIGHT = 160
const CORNER_SIZE = 34
const CORNER_THICKNESS = 4
const CORNER_RADIUS = 18

function Viewfinder({
  isProcessing,
  mode,
}: ViewfinderProps): React.ReactElement {
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

  // In barcode mode we show a shorter, wider "letterbox" frame with a
  // cyan-tinted corner — nudges users to align a horizontal barcode
  // inside the band instead of a food plate.
  const isBarcode = mode === 'barcode'
  const frameHeight = isBarcode ? BARCODE_VIEWFINDER_HEIGHT : VIEWFINDER_SIZE
  const frameBorderColor = isBarcode ? '#7BD0FF' : '#7DD9B8' // cyan vs mint-300

  const cornerBase = {
    position: 'absolute' as const,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: frameBorderColor,
  }

  return (
    <View
      style={{
        width: VIEWFINDER_SIZE,
        height: frameHeight,
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

      {/* Horizontal scan line for barcode mode — static, but the pulsing
          corner opacity already gives the viewfinder motion. */}
      {isBarcode ? (
        <View
          className="absolute left-4 right-4"
          style={{
            top: frameHeight / 2 - 1,
            height: 2,
            backgroundColor: '#7BD0FF',
            opacity: 0.7,
            borderRadius: 2,
          }}
        />
      ) : null}

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
// Scan error overlay — surfaces Gemini scan failures
// ═══════════════════════════════════════════════════════════════

interface ScanErrorOverlayProps {
  error: Error
  onDismiss: () => void
}

/**
 * Translate an AI error into something a user actually wants to read.
 * We peek at the `code` property that every error class in `src/lib/ai/types.ts`
 * sets so we can narrow without importing the classes (keeps this file
 * provider-neutral at the import level).
 */
function friendlyScanErrorMessage(error: Error): {
  title: string
  body: string
} {
  const code = (error as { code?: string }).code
  switch (code) {
    case 'key_missing':
      return {
        title: 'API key missing',
        body: 'Add your Gemini API key in Settings to enable food scanning.',
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
        body: 'Gemini returned something unexpected. Try another photo.',
      }
    case 'api_error':
      return {
        title: 'Scan failed',
        body: 'Something went wrong talking to Gemini. Check your connection and try again.',
      }
    case 'not_found':
      return {
        title: 'Product not found',
        body: 'This barcode isn\u2019t in our database yet. Try the camera scan instead.',
      }
    case 'network_error':
      return {
        title: 'Couldn\u2019t reach the database',
        body: 'Check your connection and try scanning the barcode again.',
      }
    default:
      return {
        title: 'Scan failed',
        body: error.message || 'Something went wrong. Try again.',
      }
  }
}

function ScanErrorOverlay({
  error,
  onDismiss,
}: ScanErrorOverlayProps): React.ReactElement {
  const { title, body } = friendlyScanErrorMessage(error)

  return (
    <View
      className="absolute left-6 right-6 items-center"
      style={{ top: '35%' }}
      pointerEvents="box-none"
    >
      <View
        className="w-full rounded-3xl bg-white p-6"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.35,
          shadowRadius: 28,
          elevation: 10,
        }}
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
