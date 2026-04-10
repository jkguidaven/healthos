// ═══════════════════════════════════════════════════════════════
// src/lib/ai/api-key.ts
// ─────────────────────────────────────────────────────────────
// All SecureStore operations for the AI provider key.
// This is the ONLY file that reads or writes the API key.
//
// Provider: Google Gemini (free tier, no credit card required).
// Get a key at https://aistudio.google.com/apikey
// ═══════════════════════════════════════════════════════════════

import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { useUIStore } from '../../stores/ui-store'

// Storage key. Renamed from `anthropic_api_key` to be provider-neutral.
const SECURE_KEY = 'gemini_api_key'
// Validation endpoint — listing models is the lightest call that proves
// the key works. Returns 200 on valid keys, 400 on invalid keys.
const VALIDATION_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// expo-secure-store is not supported on web (it uses iOS Keychain / Android
// Keystore). On web we fall back to localStorage so the dev experience works,
// but production builds target iOS/Android where the secure enclave is used.
const isWeb = Platform.OS === 'web'

async function readKey(): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(SECURE_KEY) ?? null
  return SecureStore.getItemAsync(SECURE_KEY)
}

async function writeKey(value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(SECURE_KEY, value)
    return
  }
  await SecureStore.setItemAsync(SECURE_KEY, value)
}

async function deleteKey(): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(SECURE_KEY)
    return
  }
  await SecureStore.deleteItemAsync(SECURE_KEY)
}

export async function getApiKey(): Promise<string | null> {
  return readKey()
}

export async function saveApiKey(key: string): Promise<void> {
  await writeKey(key)
  useUIStore.getState().setHasApiKey(true)
}

export async function clearApiKey(): Promise<void> {
  await deleteKey()
  useUIStore.getState().setHasApiKey(false)
}

export async function hydrateApiKeyStatus(): Promise<void> {
  const key = await readKey()
  useUIStore.getState().setHasApiKey(!!key)
}

export type ValidationErrorCode =
  | 'invalid_key'
  | 'network_error'
  | 'rate_limit'

export interface ValidationResult {
  valid: boolean
  error?: ValidationErrorCode
}

export async function validateApiKey(key: string): Promise<ValidationResult> {
  try {
    // List models with the key as a query param. Lightweight (no token cost),
    // and the response code unambiguously tells us if the key is valid.
    const url = `${VALIDATION_URL}?key=${encodeURIComponent(key)}`
    const response = await fetch(url, { method: 'GET' })

    if (response.ok) return { valid: true }
    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: 'invalid_key' }
    }
    if (response.status === 429) return { valid: false, error: 'rate_limit' }

    // Gemini returns 400 for invalid keys with "API_KEY_INVALID" in the body
    if (response.status === 400) {
      try {
        const text = await response.text()
        if (/API_KEY_INVALID/i.test(text) || /api key/i.test(text)) {
          return { valid: false, error: 'invalid_key' }
        }
      } catch {
        // fall through to network_error
      }
    }

    // Anything else — surface for debugging without leaking the key
    let detail = ''
    try {
      detail = await response.text()
    } catch {
      detail = `HTTP ${response.status}`
    }
    console.warn('[validateApiKey] Gemini returned non-OK:', response.status, detail)
    return { valid: false, error: 'network_error' }
  } catch (e) {
    console.warn('[validateApiKey] fetch threw:', e)
    return { valid: false, error: 'network_error' }
  }
}
