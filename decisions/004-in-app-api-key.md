# ADR 004 — In-app API key via expo-secure-store

**Status:** Accepted

## Decision

User enters their Google Gemini API key during onboarding. Stored in `expo-secure-store` (iOS Keychain / Android Keystore). No `.env` file, no EAS Secrets, no backend proxy.

## Rationale

- **Zero setup** — a non-developer can install and use the app without touching a terminal
- **Genuinely shareable** — the open-source repo contains no secrets whatsoever
- **Secure storage** — device secure enclave, encrypted at rest, inaccessible to other apps
- **Privacy** — each user's key is tied to their own Google account; the developer never sees it
- **No backend dependency** — a proxy key approach would require maintaining a server indefinitely

## Implementation summary

- Collected in onboarding step 2, validated with a lightweight `GET /v1beta/models?key=...` call before saving
- Read at call-time by `ai-client.ts` via `api-key.ts`
- `hasApiKey: boolean` in Zustand ui-store for fast UI gating
- Full lifecycle: `docs/api-key-flow.md`

## Consequences

- Users must actively obtain a Gemini API key from `https://aistudio.google.com/apikey` (direct link provided in onboarding; free tier needs no credit card)
- Android: key is cleared on app uninstall. iOS: persists if iCloud Keychain is enabled.
- No `.env.example` in this repo — intentional
