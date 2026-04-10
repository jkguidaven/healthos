/**
 * src/features/nutrition/use-food-camera.ts
 *
 * Layer 3 — Feature hook for the food-scan camera overlay.
 *
 * Owns the camera ref, permission state, front/back facing toggle, and
 * the capture-then-preprocess pipeline. Capture flow:
 *
 *   takePictureAsync (JPEG, quality 0.8)
 *     → manipulateAsync: resize width 1024 → JPEG quality 0.8, base64
 *     → { base64, mimeType: 'image/jpeg' }
 *
 * The screen component stays dumb — it only wires UI to this hook. The
 * hook intentionally performs no AI calls; the base64 payload is handed
 * off to the confirm screen (see issue #35) which owns the Gemini call.
 *
 * Hard rules honoured:
 *  - No `any`
 *  - Platform-guarded: camera surface is only rendered on iOS / Android.
 *    This hook still mounts on web, but `capture()` safely no-ops there.
 *  - No direct fetch / AI imports here — pure device I/O.
 */

import { useCallback, useRef, useState } from 'react'
import { Platform } from 'react-native'
import {
  CameraView,
  useCameraPermissions,
  type CameraType,
  type PermissionResponse,
} from 'expo-camera'
import * as ImageManipulator from 'expo-image-manipulator'

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

export interface CapturedFood {
  base64: string
  mimeType: 'image/jpeg'
}

export interface UseFoodCameraReturn {
  cameraRef: React.RefObject<CameraView | null>
  permission: PermissionResponse | null
  requestPermission: () => Promise<PermissionResponse>
  facing: CameraType
  toggleFacing: () => void
  isCapturing: boolean
  capture: () => Promise<CapturedFood | null>
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useFoodCamera(): UseFoodCameraReturn {
  const cameraRef = useRef<CameraView | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [isCapturing, setIsCapturing] = useState<boolean>(false)

  const toggleFacing = useCallback((): void => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'))
  }, [])

  const capture = useCallback(async (): Promise<CapturedFood | null> => {
    // Web has no camera ref in this app (we render a fallback instead).
    if (Platform.OS === 'web') return null
    if (isCapturing) return null
    if (!cameraRef.current) return null

    setIsCapturing(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.8,
        skipProcessing: false,
      })

      if (!photo?.uri) return null

      const processed = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1024 } }],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      )

      if (!processed.base64) return null

      return {
        base64: processed.base64,
        mimeType: 'image/jpeg',
      }
    } finally {
      setIsCapturing(false)
    }
  }, [isCapturing])

  return {
    cameraRef,
    permission,
    requestPermission,
    facing,
    toggleFacing,
    isCapturing,
    capture,
  }
}
