# ADR 001 — Local-first, no backend

**Status:** Accepted

## Decision

All data is stored locally on the device using SQLite via Drizzle ORM. No server, no auth, no cloud sync.

## Rationale

- Personal tool — no user data should leave the device except for AI API calls (user's own key)
- Zero infrastructure cost — nothing to host, pay for, or maintain
- Open-source friendly — fork, install, run. No backend setup required
- Privacy by design — the app cannot leak data it never has

## Consequences

- No cross-device sync. Acceptable for a personal tool.
- Data lost if device is lost (JSON export planned as mitigation)
- Cannot build social features without revisiting this decision
