/**
 * src/features/metrics/use-progress-photos.ts
 *
 * Feature hook for the progress photos screen.
 *
 * Owns:
 *   - listing every progress photo (newest first)
 *   - capturing a photo via the camera (or falling back to the library on
 *     web, where camera capture isn't reliably supported)
 *   - importing a photo from the device library
 *   - deleting a photo (and its on-disk file)
 *
 * Photo storage strategy:
 *   The image picker hands us a temporary URI that may live in the cache
 *   directory and can be evicted by the OS. We copy the file into a stable
 *   location under the document directory (`progress-photos/`) using a
 *   UUID + the original extension so the URI persists across launches.
 *   Only the persistent URI is written to SQLite — never the bytes.
 *
 * Platform guards:
 *   The camera and the file-system module only behave correctly on iOS and
 *   Android. On web we fall back to the library picker (which the picker
 *   handles natively via an <input type="file"> shim) and skip the
 *   document-directory copy step because the picker already returns a
 *   long-lived blob URL on web.
 *
 * Convention:
 *   Plain async functions returned from the hook (no react-query). Mirrors
 *   the canonical `useWaterLog` shape — list/save/delete + a `refresh` for
 *   manual re-fetch.
 */

import { useCallback, useMemo, useState } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as ImagePicker from 'expo-image-picker'
import { Directory, File, Paths } from 'expo-file-system'

import * as schema from '@db/schema'
import {
  deleteProgressPhoto,
  insertProgressPhoto,
  listProgressPhotos,
} from '@db/queries/progress-photos'
import type { ProgressPhoto } from '@db/schema'
import { useProfileStore } from '@/stores/profile-store'

// ─────────────────────────────────────────────
// Public shape
// ─────────────────────────────────────────────

export type PhotoSource = 'camera' | 'library'

export interface UseProgressPhotosResult {
  photos: ProgressPhoto[]
  loading: boolean
  /** True while a save (capture/import + DB insert) is in progress. */
  saving: boolean
  refresh: () => Promise<void>
  /** Returns the inserted row, or null if the user cancelled the picker. */
  addPhoto: (source: PhotoSource) => Promise<ProgressPhoto | null>
  /** True if the camera flow is supported on this platform. */
  cameraSupported: boolean
  remove: (id: number) => Promise<void>
}

// ─────────────────────────────────────────────
// Lowest-level platform wrappers
// ─────────────────────────────────────────────

const isWeb = Platform.OS === 'web'

/**
 * The expo-file-system `Paths.document` directory only exists on native.
 * On web we just hand back the picker's native blob/URL because there's
 * no persistent filesystem to copy into.
 */
const PHOTO_DIR_NAME = 'progress-photos'

function ensurePhotoDirectory(): Directory | null {
  if (isWeb) return null
  const dir = new Directory(Paths.document, PHOTO_DIR_NAME)
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true })
  }
  return dir
}

/**
 * Generate a filesystem-safe filename for a freshly captured/imported asset.
 * Uses a timestamp + a short random suffix so two captures in the same
 * millisecond don't collide.
 */
function generatePhotoFilename(extension: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const ext = extension.startsWith('.') ? extension : `.${extension}`
  return `${ts}-${rand}${ext}`
}

/**
 * Pull a sensible file extension out of an image-picker asset. The picker
 * doesn't always populate `fileName`, so we fall back to the URI suffix
 * and finally to `.jpg` (the picker's default output format).
 */
function extensionFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  const fromName =
    typeof asset.fileName === 'string' && asset.fileName.includes('.')
      ? asset.fileName.slice(asset.fileName.lastIndexOf('.'))
      : null
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  const fromUri =
    asset.uri.includes('.') && !asset.uri.startsWith('data:')
      ? asset.uri.slice(asset.uri.lastIndexOf('.')).split('?')[0]
      : null
  if (fromUri && fromUri.length <= 5) return fromUri.toLowerCase()
  return '.jpg'
}

/**
 * Copy the picker's temporary file into our stable progress-photos
 * directory and return the new persistent URI. On web there's nothing to
 * copy — the picker already returns a usable URL — so we hand the original
 * URI back as-is.
 */
function persistPickerAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (isWeb) return asset.uri
  const dir = ensurePhotoDirectory()
  if (!dir) return asset.uri

  const ext = extensionFromAsset(asset)
  const filename = generatePhotoFilename(ext)
  const source = new File(asset.uri)
  const destination = new File(dir, filename)
  source.copy(destination)
  return destination.uri
}

/**
 * Best-effort delete of a persisted photo file. Swallows errors so a
 * stale URI never blocks the row from being removed from SQLite.
 */
function removePhotoFile(uri: string): void {
  if (isWeb) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch {
    // Intentionally ignored — DB row removal is the source of truth.
  }
}

/**
 * Launch the camera (native) or fall through to the library on web.
 * Returns the picked asset or null if the user cancelled.
 */
async function launchCaptureFlow(): Promise<ImagePicker.ImagePickerAsset | null> {
  if (isWeb) {
    // expo-image-picker on web can't drive the camera reliably across
    // browsers, so we hand the user the file picker which natively offers
    // a "Take photo" option on most mobile browsers anyway.
    return launchLibraryFlow()
  }
  const perm = await ImagePicker.requestCameraPermissionsAsync()
  if (!perm.granted) return null

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  })
  if (result.canceled) return null
  return result.assets[0] ?? null
}

/**
 * Launch the photo library picker. Works on iOS, Android, and web.
 */
async function launchLibraryFlow(): Promise<ImagePicker.ImagePickerAsset | null> {
  if (!isWeb) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  })
  if (result.canceled) return null
  return result.assets[0] ?? null
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export function useProgressPhotos(): UseProgressPhotosResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const profile = useProfileStore((state) => state.profile)
  const profileId = profile?.id ?? null

  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)

  const fetchPhotos = useCallback(async (): Promise<void> => {
    if (profileId === null) {
      setPhotos([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const rows = await listProgressPhotos(db, profileId)
      setPhotos(rows)
    } finally {
      setLoading(false)
    }
  }, [db, profileId])

  // Re-fetch when the screen gains focus so a delete/capture flow on a
  // pushed sub-screen reflects when the user lands back on the gallery.
  useFocusEffect(
    useCallback(() => {
      void fetchPhotos()
    }, [fetchPhotos]),
  )

  const refresh = useCallback(async (): Promise<void> => {
    await fetchPhotos()
  }, [fetchPhotos])

  const addPhoto = useCallback(
    async (source: PhotoSource): Promise<ProgressPhoto | null> => {
      if (profileId === null) return null
      setSaving(true)
      try {
        const asset =
          source === 'camera'
            ? await launchCaptureFlow()
            : await launchLibraryFlow()
        if (!asset) return null

        const persistedUri = persistPickerAsset(asset)
        const inserted = await insertProgressPhoto(db, {
          profileId,
          date: todayIso(),
          fileUri: persistedUri,
          angle: 'front',
          notes: null,
        })
        await fetchPhotos()
        return inserted
      } finally {
        setSaving(false)
      }
    },
    [db, profileId, fetchPhotos],
  )

  const remove = useCallback(
    async (id: number): Promise<void> => {
      if (profileId === null) return
      const removed = await deleteProgressPhoto(db, profileId, id)
      if (removed) removePhotoFile(removed.fileUri)
      await fetchPhotos()
    },
    [db, profileId, fetchPhotos],
  )

  return {
    photos,
    loading,
    saving,
    refresh,
    addPhoto,
    cameraSupported: !isWeb,
    remove,
  }
}
