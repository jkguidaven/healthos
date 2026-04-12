# ADR 002 — Drizzle ORM over raw SQL

**Status:** Accepted

## Decision

Use Drizzle ORM with expo-sqlite. Schema in `src/lib/db/schema.ts`. Migrations via `drizzle-kit`. All queries use Drizzle's query builder.

## Rationale

- **Type safety** — schema defined once, types inferred via `$inferSelect` / `$inferInsert`
- **`useLiveQuery`** — reactive queries that auto-update components when data changes
- **Drizzle Studio** — browser-based DB inspector as an Expo dev plugin
- **Migration tracking** — generated migration files committed to repo, schema changes are auditable
- **No raw SQL** — prevents injection, keeps query style consistent

## Consequences

- After any schema change: run `pnpm db:generate`, commit migration files, run `pnpm db:migrate`
- Never hand-edit migration files
- If Drizzle can't express a query, open a discussion before writing raw SQL
