/**
 * src/features/settings/use-data-export.ts
 *
 * Feature hook for "Export all data" in Settings.
 *
 * Layer 3 of the canonical feature stack — owns the side-effect of:
 *   1. Selecting every row from every table via `dumpAllTables()`
 *   2. Serialising the result to pretty-printed JSON
 *   3. Persisting + sharing the file via the platform-aware
 *      `writeAndShareJson()` wrapper (native share sheet on iOS/Android,
 *      browser download on web)
 *
 * Modelled after `use-water-log.ts`: a plain async hook (NOT useMutation),
 * exposing `{ exportAll, isExporting, error, lastExportedAt }` so the screen
 * can render an inline status row without managing its own state.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSQLiteContext } from 'expo-sqlite'
import { drizzle } from 'drizzle-orm/expo-sqlite'

import * as schema from '@db/schema'
import { dumpAllTables } from '@db/queries/data-export'
import {
  buildExportFileName,
  writeAndShareJson,
} from '@/lib/data-export/share-export'

const APP_VERSION = 'v0.1'

export interface UseDataExportResult {
  /** Trigger a full export. Resolves once the share sheet has been shown. */
  exportAll: () => Promise<void>
  /** True while a dump + share is in flight. */
  isExporting: boolean
  /** Last error encountered, if any. Cleared on the next `exportAll()` call. */
  error: Error | null
  /** Timestamp of the most recent successful export, or null if none. */
  lastExportedAt: Date | null
}

export function useDataExport(): UseDataExportResult {
  const sqlite = useSQLiteContext()
  const db = useMemo(() => drizzle(sqlite, { schema }), [sqlite])

  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastExportedAt, setLastExportedAt] = useState<Date | null>(null)

  const exportAll = useCallback(async (): Promise<void> => {
    setIsExporting(true)
    setError(null)
    try {
      const payload = await dumpAllTables(db, APP_VERSION)
      const json = JSON.stringify(payload, null, 2)
      const fileName = buildExportFileName()
      await writeAndShareJson(fileName, json)
      setLastExportedAt(new Date())
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      setError(err)
      throw err
    } finally {
      setIsExporting(false)
    }
  }, [db])

  return { exportAll, isExporting, error, lastExportedAt }
}
