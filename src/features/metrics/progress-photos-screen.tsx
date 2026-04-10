/**
 * src/features/metrics/progress-photos-screen.tsx
 *
 * Layer 4 — Progress photos gallery (Screen 16).
 *
 * Pushed sub-screen of the Body tab. Shows a 3-column grid of every photo
 * the user has captured, sorted newest first. Tapping a thumbnail opens a
 * full-screen lightbox modal with a delete affordance. A floating "+ Add"
 * pill in the bottom-right launches a small action sheet that offers
 * camera capture or library import.
 *
 * Empty state: a soft mint card with a friendly headline + primary CTA
 * that fires the same capture flow.
 *
 * Visual language matches the rest of the Body tab — flat white surface,
 * rounded-3xl borders, mint accents, Poppins-only.
 */

import React, { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import type { ProgressPhoto } from '@db/schema'
import {
  useProgressPhotos,
  type PhotoSource,
} from './use-progress-photos'

// ─────────────────────────────────────────────
// Shared shadow tokens
// ─────────────────────────────────────────────

const PILL_SHADOW = {
  shadowColor: '#2BBF9E',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 18,
  elevation: 8,
} as const

const SOFT_CARD_SHADOW = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
} as const

// 3-column grid with comfortable gutters. The screen has 20px outer
// padding and 10px gaps between thumbnails.
const HORIZONTAL_PADDING = 20
const GRID_GAP = 10
const GRID_COLUMNS = 3

// ─────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────

export function ProgressPhotosScreen(): React.ReactElement {
  const {
    photos,
    loading,
    saving,
    addPhoto,
    cameraSupported,
    remove,
  } = useProgressPhotos()

  const [actionSheetOpen, setActionSheetOpen] = useState<boolean>(false)
  const [lightboxPhoto, setLightboxPhoto] = useState<ProgressPhoto | null>(
    null,
  )

  const { width: windowWidth } = useWindowDimensions()
  const tileSize = useMemo(() => {
    const usable = windowWidth - HORIZONTAL_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)
    const size = Math.floor(usable / GRID_COLUMNS)
    return Math.max(size, 96)
  }, [windowWidth])

  const handleBack = useCallback((): void => {
    router.back()
  }, [])

  const openSheet = useCallback((): void => {
    if (!cameraSupported) {
      // No need to ask camera vs library on web — just go straight to
      // the library picker.
      void addPhoto('library')
      return
    }
    setActionSheetOpen(true)
  }, [addPhoto, cameraSupported])

  const handlePickSource = useCallback(
    async (source: PhotoSource): Promise<void> => {
      setActionSheetOpen(false)
      await addPhoto(source)
    },
    [addPhoto],
  )

  const openLightbox = useCallback((photo: ProgressPhoto): void => {
    setLightboxPhoto(photo)
  }, [])

  const closeLightbox = useCallback((): void => {
    setLightboxPhoto(null)
  }, [])

  const confirmDelete = useCallback(
    (photo: ProgressPhoto): void => {
      Alert.alert(
        'Delete this photo?',
        'It will be removed from your progress gallery for good.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              setLightboxPhoto(null)
              void remove(photo.id)
            },
          },
        ],
      )
    },
    [remove],
  )

  const showEmptyState = !loading && photos.length === 0

  return (
    <View className="flex-1 bg-white">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* === TOP BAR === */}
        <View
          className="flex-row items-center justify-between"
          style={{
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
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
          <Text className="font-sans-semibold text-[16px] text-slate-900">
            Progress photos
          </Text>
          <View className="h-10 w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: HORIZONTAL_PADDING,
            paddingBottom: 140,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* === HEADLINE === */}
          <View className="mt-4">
            <Text
              className="font-sans-bold text-[28px] text-slate-900"
              style={{ letterSpacing: -0.5, lineHeight: 34 }}
            >
              Your timeline
            </Text>
            <Text className="mt-2 font-sans text-[14px] text-slate-500">
              {photos.length === 0
                ? 'A photo every couple of weeks tells the truth.'
                : `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} captured so far.`}
            </Text>
          </View>

          {loading ? (
            <View className="mt-12 items-center">
              <Text className="font-sans text-[13px] text-slate-400">
                Loading…
              </Text>
            </View>
          ) : showEmptyState ? (
            <EmptyState onAdd={openSheet} disabled={saving} />
          ) : (
            <PhotoGrid
              photos={photos}
              tileSize={tileSize}
              onTap={openLightbox}
            />
          )}
        </ScrollView>

        {/* === FLOATING ADD PILL === */}
        {!loading && photos.length > 0 ? (
          <View
            pointerEvents="box-none"
            className="absolute inset-x-0 bottom-0"
            style={{
              paddingHorizontal: HORIZONTAL_PADDING,
              paddingBottom: 28,
            }}
          >
            <View className="items-end">
              <Pressable
                onPress={openSheet}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Add a photo"
                className="active:opacity-90"
              >
                <View
                  className="flex-row items-center gap-2 rounded-full bg-mint-500 px-5 py-4"
                  style={PILL_SHADOW}
                >
                  <Text className="font-sans-semibold text-[16px] text-white">
                    +
                  </Text>
                  <Text className="font-sans-semibold text-[14px] text-white">
                    Add photo
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>

      {/* === SOURCE PICKER (camera vs library) === */}
      <ActionSheet
        visible={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        onPick={handlePickSource}
      />

      {/* === LIGHTBOX === */}
      <Lightbox
        photo={lightboxPhoto}
        onClose={closeLightbox}
        onDelete={confirmDelete}
      />
    </View>
  )
}

// ─────────────────────────────────────────────
// Empty state — friendly mint surface, single CTA.
// Lives where the grid would otherwise sit so the user lands on it
// immediately on first visit.
// ─────────────────────────────────────────────

interface EmptyStateProps {
  onAdd: () => void
  disabled: boolean
}

function EmptyState({ onAdd, disabled }: EmptyStateProps): React.ReactElement {
  return (
    <View className="mt-8 items-center rounded-3xl bg-mint-50 px-6 py-12">
      {/* Decorative double-ringed avatar */}
      <View
        className="h-24 w-24 items-center justify-center rounded-full bg-white"
        style={SOFT_CARD_SHADOW}
      >
        <View className="h-16 w-16 items-center justify-center rounded-full bg-mint-100">
          <Text className="text-[32px]">📷</Text>
        </View>
      </View>
      <Text
        className="mt-6 text-center font-sans-bold text-[22px] text-slate-900"
        style={{ letterSpacing: -0.3 }}
      >
        Take your first photo
      </Text>
      <Text className="mt-2 max-w-[280px] text-center font-sans text-[13px] text-slate-600">
        The scale lies, the mirror forgets. Side-by-side photos are the
        most honest signal you have.
      </Text>
      <Pressable
        onPress={onAdd}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Take your first photo"
        hitSlop={6}
        className={`mt-6 rounded-full bg-mint-500 px-7 py-4 active:opacity-80 ${
          disabled ? 'opacity-60' : ''
        }`}
        style={PILL_SHADOW}
      >
        <Text className="font-sans-semibold text-[14px] text-white">
          Capture a photo
        </Text>
      </Pressable>
    </View>
  )
}

// ─────────────────────────────────────────────
// Photo grid — 3-column rows with rounded square thumbnails.
// Each tile carries a date pill on a translucent base so the timeline
// stays scannable without leaving the grid.
// ─────────────────────────────────────────────

interface PhotoGridProps {
  photos: ProgressPhoto[]
  tileSize: number
  onTap: (photo: ProgressPhoto) => void
}

function PhotoGrid({
  photos,
  tileSize,
  onTap,
}: PhotoGridProps): React.ReactElement {
  const rows: ProgressPhoto[][] = []
  for (let i = 0; i < photos.length; i += GRID_COLUMNS) {
    rows.push(photos.slice(i, i + GRID_COLUMNS))
  }

  return (
    <View className="mt-6">
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          className="flex-row"
          style={{
            marginTop: rowIndex === 0 ? 0 : GRID_GAP,
          }}
        >
          {row.map((photo, columnIndex) => (
            <View
              key={photo.id}
              style={{
                marginLeft: columnIndex === 0 ? 0 : GRID_GAP,
              }}
            >
              <PhotoTile photo={photo} size={tileSize} onTap={onTap} />
            </View>
          ))}
          {/* Fill the trailing slots in the last row so the rhythm holds. */}
          {row.length < GRID_COLUMNS
            ? Array.from({ length: GRID_COLUMNS - row.length }).map((_, i) => (
                <View
                  key={`spacer-${i}`}
                  style={{
                    width: tileSize,
                    marginLeft: GRID_GAP,
                  }}
                />
              ))
            : null}
        </View>
      ))}
    </View>
  )
}

interface PhotoTileProps {
  photo: ProgressPhoto
  size: number
  onTap: (photo: ProgressPhoto) => void
}

function PhotoTile({ photo, size, onTap }: PhotoTileProps): React.ReactElement {
  return (
    <Pressable
      onPress={() => onTap(photo)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Progress photo from ${formatDateShort(photo.date)}`}
      className="active:opacity-80"
    >
      <View
        className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50"
        style={{ width: size, height: size }}
      >
        <Image
          source={{ uri: photo.fileUri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Date pill — softly pinned to the bottom-left corner */}
        <View className="absolute bottom-1.5 left-1.5 rounded-full bg-slate-900/70 px-2 py-0.5">
          <Text className="font-sans-medium text-[10px] text-white">
            {formatDateShort(photo.date)}
          </Text>
        </View>
      </View>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Action sheet — slides up from the bottom on top of a dimmed scrim.
// Two big rounded options: Camera vs Photo library.
// ─────────────────────────────────────────────

interface ActionSheetProps {
  visible: boolean
  onClose: () => void
  onPick: (source: PhotoSource) => void
}

function ActionSheet({
  visible,
  onClose,
  onPick,
}: ActionSheetProps): React.ReactElement {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        className="flex-1 justify-end bg-slate-900/40"
      >
        {/* Inner pressable swallows taps so the sheet itself doesn't dismiss. */}
        <Pressable onPress={() => undefined}>
          <View
            className="rounded-t-[32px] bg-white px-6 pb-10 pt-7"
            style={SOFT_CARD_SHADOW}
          >
            <View className="items-center">
              <View className="h-1 w-10 rounded-full bg-slate-200" />
            </View>
            <Text
              className="mt-4 font-sans-bold text-[20px] text-slate-900"
              style={{ letterSpacing: -0.3 }}
            >
              Add a progress photo
            </Text>
            <Text className="mt-1 font-sans text-[13px] text-slate-500">
              Same lighting, same pose — that&apos;s the trick.
            </Text>

            <View className="mt-6 gap-3">
              <SourceOption
                icon="camera-outline"
                label="Take a photo"
                hint="Use the camera now"
                onPress={() => onPick('camera')}
              />
              <SourceOption
                icon="image-outline"
                label="Choose from library"
                hint="Import an existing photo"
                onPress={() => onPick('library')}
              />
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              className="mt-6 items-center rounded-full border border-slate-100 bg-white py-4 active:opacity-70"
            >
              <Text className="font-sans-semibold text-[14px] text-slate-600">
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

interface SourceOptionProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  hint: string
  onPress: () => void
}

function SourceOption({
  icon,
  label,
  hint,
  onPress,
}: SourceOptionProps): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-4 rounded-3xl border border-slate-100 bg-white px-5 py-4 active:opacity-80"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-mint-50">
        <Ionicons name={icon} size={20} color="#2BBF9E" />
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-[15px] text-slate-900">
          {label}
        </Text>
        <Text className="mt-0.5 font-sans text-[12px] text-slate-500">
          {hint}
        </Text>
      </View>
      <Text className="font-sans-medium text-[18px] text-slate-300">›</Text>
    </Pressable>
  )
}

// ─────────────────────────────────────────────
// Lightbox — full-screen modal with a single image, a date caption,
// and a delete control. Tap anywhere outside the controls to dismiss.
// ─────────────────────────────────────────────

interface LightboxProps {
  photo: ProgressPhoto | null
  onClose: () => void
  onDelete: (photo: ProgressPhoto) => void
}

function Lightbox({
  photo,
  onClose,
  onDelete,
}: LightboxProps): React.ReactElement {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={photo !== null}
      onRequestClose={onClose}
    >
      {photo ? (
        <View className="flex-1 bg-slate-900">
          <SafeAreaView edges={['top', 'bottom']} className="flex-1">
            {/* Top bar with close + delete */}
            <View
              className="flex-row items-center justify-between"
              style={{
                paddingHorizontal: HORIZONTAL_PADDING,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close photo"
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-60"
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </Pressable>
              <Text className="font-sans-semibold text-[14px] text-white">
                {formatDateLong(photo.date)}
              </Text>
              <Pressable
                onPress={() => onDelete(photo)}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-60"
              >
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              </Pressable>
            </View>

            {/* Image fills the remaining space */}
            <Pressable onPress={onClose} className="flex-1">
              <Image
                source={{ uri: photo.fileUri }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </Pressable>
          </SafeAreaView>
        </View>
      ) : (
        <View />
      )}
    </Modal>
  )
}

// ─────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────

function formatDateShort(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatDateLong(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return iso
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
