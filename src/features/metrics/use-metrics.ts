/**
 * src/features/metrics/use-metrics.ts
 *
 * Feature hook for the Body metrics tab.
 *
 * Fetches the latest body metric, the 30-day trend window, and two reference
 * points (7 and 30 days ago) so the screen can compute weekly/monthly weight
 * and body-fat deltas. Produces a recomp signal from the pure formula.
 *
 * Layer 4 (feature hook). No UI. No raw SQL — uses the Drizzle helpers in
 * `@db/queries/metrics`.
 */

import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'
import * as schema from '@db/schema'
import type { BodyMetric } from '@db/schema'
import {
  getLatestBodyMetric,
  getBodyMetricsRange,
  getBodyMetricNDaysAgo,
} from '@db/queries/metrics'
import { useProfileStore } from '@/stores/profile-store'
import {
  getRecompSignal,
  type RecompSignalResult,
} from '@formulas/recomp-signal'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface MetricsData {
  /** Most recent body_metric row, or null if the user has never logged one. */
  latest: BodyMetric | null
  /** 30-day window of body metrics, ordered oldest-first (chart-friendly). */
  thirtyDayTrend: BodyMetric[]
  /** Latest weight minus weight from 7 days ago. `null` if insufficient data. */
  weightDeltaWeek: number | null
  /** Latest weight minus weight from 30 days ago. `null` if insufficient data. */
  weightDeltaMonth: number | null
  /** Latest body fat % minus 30-day-ago body fat %. `null` if missing. */
  bodyFatDeltaMonth: number | null
  /** Latest waist (cm) minus waist from 30 days ago. `null` if missing. */
  waistDeltaMonth: number | null
  /** Interpreted recomp signal, or null if there isn't enough data. */
  recompSignal: RecompSignalResult | null
}

interface UseMetricsResult {
  data: MetricsData
  loading: boolean
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toIsoDate(d)
}

const EMPTY_METRICS: MetricsData = {
  latest: null,
  thirtyDayTrend: [],
  weightDeltaWeek: null,
  weightDeltaMonth: null,
  bodyFatDeltaMonth: null,
  waistDeltaMonth: null,
  recompSignal: null,
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useMetrics(): UseMetricsResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])
  const profileId = useProfileStore((s) => s.profile?.id ?? null)

  const [data, setData] = useState<MetricsData>(EMPTY_METRICS)
  const [loading, setLoading] = useState<boolean>(true)

  // Re-run every time the body tab gains focus, so saving a body-fat
  // calculator entry shows up immediately when the user returns.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      async function load(): Promise<void> {
      if (profileId === null) {
        if (!cancelled) {
          setData(EMPTY_METRICS)
          setLoading(false)
        }
        return
      }

      setLoading(true)

      const todayIso = toIsoDate(new Date())
      const fromIso = daysAgoIso(30)

      const [latest, trend, weekRef, monthRef] = await Promise.all([
        getLatestBodyMetric(db, profileId),
        getBodyMetricsRange(db, profileId, fromIso, todayIso),
        getBodyMetricNDaysAgo(db, profileId, 7),
        getBodyMetricNDaysAgo(db, profileId, 30),
      ])

      if (cancelled) return

      if (!latest) {
        setData(EMPTY_METRICS)
        setLoading(false)
        return
      }

      // Weight deltas — skip when the reference row is the same row as latest
      // (happens when only one entry exists) so we don't report a bogus zero.
      const weightDeltaWeek =
        weekRef && weekRef.id !== latest.id
          ? round1(latest.weightKg - weekRef.weightKg)
          : null

      const weightDeltaMonth =
        monthRef && monthRef.id !== latest.id
          ? round1(latest.weightKg - monthRef.weightKg)
          : null

      const bodyFatDeltaMonth =
        monthRef &&
        monthRef.id !== latest.id &&
        latest.bodyFatPct !== null &&
        monthRef.bodyFatPct !== null
          ? round1(latest.bodyFatPct - monthRef.bodyFatPct)
          : null

      const waistDeltaMonth =
        monthRef &&
        monthRef.id !== latest.id &&
        latest.waistCm !== null &&
        monthRef.waistCm !== null
          ? round1(latest.waistCm - monthRef.waistCm)
          : null

      // Recomp signal — needs at least a weekly weight delta. Waist/arm deltas
      // are optional and degrade the classifier gracefully to "unclear" if
      // missing.
      let recompSignal: RecompSignalResult | null = null
      if (weightDeltaWeek !== null && weekRef) {
        const waistDeltaCm =
          latest.waistCm !== null && weekRef.waistCm !== null
            ? round1(latest.waistCm - weekRef.waistCm)
            : null
        const armDeltaCm =
          latest.armCm !== null && weekRef.armCm !== null
            ? round1(latest.armCm - weekRef.armCm)
            : null
        recompSignal = getRecompSignal({
          weightDeltaKg: weightDeltaWeek,
          waistDeltaCm,
          armDeltaCm,
        })
      }

      setData({
        latest,
        thirtyDayTrend: trend,
        weightDeltaWeek,
        weightDeltaMonth,
        bodyFatDeltaMonth,
        waistDeltaMonth,
        recompSignal,
      })
      setLoading(false)
    }

      void load()
      return () => {
        cancelled = true
      }
    }, [db, profileId]),
  )

  return { data, loading }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
