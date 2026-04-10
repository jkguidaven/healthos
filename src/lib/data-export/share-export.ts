/**
 * src/lib/data-export/share-export.ts
 *
 * Lowest-level wrapper around `expo-file-system` + `expo-sharing` for the
 * data export feature. All platform branching lives here so that the feature
 * hook (`use-data-export`) and the screen stay platform-agnostic.
 *
 * Native (iOS / Android):
 *   - write JSON to a file in the cache directory
 *   - hand the file URI to `expo-sharing`'s native share sheet
 *
 * Web:
 *   - `expo-sharing` and `expo-file-system`'s native bindings are not
 *     available, so we fall back to a Blob + anchor download.
 *
 * Past incident referenced in CLAUDE.md: `expo-secure-store` was called
 * directly in `api-key.ts` and crashed the web build at boot. We pay careful
 * attention here to (a) `Platform.OS` branch BEFORE touching any native API
 * and (b) keep the imports tree-shake-friendly so the web bundle does not
 * pull in iOS-only code.
 */

import { Platform } from 'react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/** Build the cross-platform export file name for a given Date. */
export function buildExportFileName(now: Date = new Date()): string {
  const yyyy = now.getFullYear().toString().padStart(4, '0')
  const mm = (now.getMonth() + 1).toString().padStart(2, '0')
  const dd = now.getDate().toString().padStart(2, '0')
  return `healthos-export-${yyyy}-${mm}-${dd}.json`
}

const JSON_MIME_TYPE = 'application/json'

/**
 * Persist `json` somewhere the user can save it (cache + share sheet on
 * native, browser download on web).
 *
 * Returns the file URI on native, or `null` on web (where the browser owns
 * the resulting file and we have no handle to it).
 */
export async function writeAndShareJson(
  fileName: string,
  json: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    triggerWebDownload(fileName, json)
    return null
  }

  // Native path — write to cache, then open the system share sheet.
  const file = new File(Paths.cache, fileName)
  if (file.exists) {
    file.delete()
  }
  file.create()
  file.write(json)

  const canShare = await Sharing.isAvailableAsync()
  if (canShare) {
    await Sharing.shareAsync(file.uri, {
      mimeType: JSON_MIME_TYPE,
      UTI: 'public.json',
      dialogTitle: 'Export HealthOS data',
    })
  }

  return file.uri
}

/**
 * Browser fallback — create a Blob, point an `<a download>` at it, click it,
 * and clean up. Guarded against non-DOM environments (Jest, SSR) so that
 * unit tests don't blow up if they happen to import this module.
 */
function triggerWebDownload(fileName: string, json: string): void {
  const doc = (globalThis as { document?: Document }).document
  if (!doc || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return
  }

  const blob = new Blob([json], { type: JSON_MIME_TYPE })
  const url = URL.createObjectURL(blob)

  const anchor = doc.createElement('a')
  anchor.href = url
  anchor.download = fileName
  doc.body.appendChild(anchor)
  anchor.click()
  doc.body.removeChild(anchor)

  URL.revokeObjectURL(url)
}
