# HealthOS — UX wireframes & screen documentation

> **AI context note:** This document describes every screen in the HealthOS mobile app at a wire­frame level. When building any screen, read the relevant section here first. Layout decisions, component hierarchy, colour usage, and interaction patterns are all specified. This is the single source of truth for UI structure.

---

## Document structure

- [Design system tokens](#design-system-tokens)
- [Navigation architecture](#navigation-architecture)
- [Onboarding flow (4 screens)](#onboarding-flow)
- [Main tabs (5 screens)](#main-tabs)
- [Overlay screens (5 screens)](#overlay-screens)
- [Error & empty states](#error--empty-states)
- [Screen inventory](#screen-inventory)

---

## Design system tokens

### Colours (NativeWind / Tailwind classes)

| Role | Light | Dark | Usage |
|---|---|---|---|
| Surface primary | `bg-white` | `bg-zinc-900` | Cards, inputs |
| Surface secondary | `bg-zinc-50` | `bg-zinc-800` | Grouped rows, stat tiles |
| Brand green | `#1D9E75` | `#1D9E75` | Primary CTAs, protein, success |
| Brand purple | `#534AB7` | `#7F77DD` | AI features, protein macro |
| Brand amber | `#EF9F27` | `#EF9F27` | Medium confidence, warnings |
| Brand coral | `#D85A30` | `#D85A30` | Fat macro, danger |
| Brand blue | `#185FA5` | `#378ADD` | Links, info, barcode |
| Text primary | `text-zinc-900` | `text-zinc-100` | Headings, values |
| Text secondary | `text-zinc-500` | `text-zinc-400` | Labels, subtitles |
| Text tertiary | `text-zinc-400` | `text-zinc-600` | Captions, hints |
| Border | `border-zinc-200` | `border-zinc-700` | Card borders, dividers |

### Typography scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `heading-lg` | 17px / 500 | Screen titles |
| `heading-md` | 14–15px / 500 | Section headers |
| `body` | 12–13px / 400 | Body text, list items |
| `label` | 10–11px / 400 | Field labels, captions |
| `caption` | 9px / 400 | Badges, footnotes |
| `stat` | 16–28px / 500 | Numbers in metric tiles |

### Spacing

- Screen horizontal padding: `16px`
- Card padding: `8–10px`
- Gap between cards: `5–6px`
- Gap between sections: `10–12px`

### Component patterns

**Metric tile** — `bg-surface-secondary`, `rounded-lg`, `p-8`, contains: label (9px tertiary above), value (16px bold), subtitle (9px secondary), optional progress bar (3px, rounded)

**Confidence badge** — pill shape, 8px font. Green = AI high, Amber = AI medium, Blue = barcode, no badge = manual entry

**Section header** — 9px, uppercase, letter-spacing 0.5px, tertiary colour, `mb-5`

**CTA button (primary)** — `bg-brand-green`, `rounded-lg`, `p-10`, `text-white`, `font-medium 13px`, full width

**CTA button (secondary)** — `bg-surface-secondary`, `border`, `rounded-lg`, `p-9`, `text-secondary 11px`, full width

**Tab bar** — `border-t`, 5 tabs, each: 16×16 icon dot + 8px label. Active: brand green. Inactive: tertiary.

---

## Navigation architecture

```
app/
├── (onboarding)/           shown when profile empty OR hasApiKey false
│   ├── index               welcome screen
│   ├── profile             basic info step
│   ├── goal                goal + activity step
│   └── api-key             API key step
│
└── (tabs)/                 shown after onboarding complete
    ├── index               Dashboard (Home)
    ├── food                Food log
    │   └── scan            Camera overlay (modal)
    ├── workout             Active session / plan view
    │   └── generate        Plan generator modal
    ├── body                Body metrics
    │   └── body-fat        Body fat calculator modal
    └── coach               AI coach / weekly digest

    (shared modals)
    ├── settings/index      Settings screen
    └── settings/api-key    API key update modal
```

**Navigation rules:**
- Onboarding uses `router.replace` — no back button to welcome screen from main app
- Camera scan is a full-screen modal pushed over the food tab
- Plan generator is a bottom sheet modal over the workout tab
- Body fat calculator is a bottom sheet modal over the body tab
- Settings is accessible via avatar tap on the dashboard header

---

## Onboarding flow

### Screen 1 — Welcome

**File:** `app/(onboarding)/index.tsx`
**Purpose:** Orient the user, set expectations, zero friction entry point.

**Layout (top to bottom):**
1. App icon — 52×52px, rounded-2xl, `bg-teal-100`, circle border `border-2 border-brand-green`, centred
2. App name — "HealthOS", 17px/500, centred, `mt-14`
3. Tagline — 12px, secondary colour, centred, `mt-6`, line-height 1.6, max 2 lines
4. Feature list — 4 items, each row: 8px coloured dot + 11px label, `bg-surface-secondary`, `rounded-lg`, `p-8 px-12`, `gap-6` between rows. Dot colours: green, purple, coral, amber (matches pillar colours)
5. CTA button — "Get started", primary green, `mt-20`
6. Trust line — "All data stays on your device · no account needed", 10px, tertiary, centred, `mt-10`

**State:** No inputs. Single action.

**Component notes:**
- Feature list items are purely decorative at this point — no interaction
- CTA calls `router.push('/(onboarding)/profile')`

---

### Screen 2 — Basic info

**File:** `app/(onboarding)/profile.tsx`
**Purpose:** Collect biometric data for TDEE + macro calculation.

**Layout:**
1. Progress bar — 3 segments (1 filled green, 2 empty), `h-3`, `rounded-full`, `gap-4`, `mb-14`
2. Screen title — "Basic info", `heading-md`
3. Subtitle — "Used to calculate your TDEE and macro targets", 11px secondary
4. Form fields (react-hook-form + Zod):
   - Age + Sex — 2-column grid, `bg-surface-secondary`, `rounded-lg`, `p-8 px-10`
   - Height + Weight — 2-column grid, same style
   - Units toggle — 2 options side by side. Selected: `bg-brand-green text-white`. Unselected: `bg-surface-secondary text-secondary`
5. Live BMR result card — `bg-surface-secondary`, `rounded-lg`, `p-9`, shows: label "Calculated BMR" (10px tertiary), value "1,840 kcal / day" (16px bold), footnote "Mifflin-St Jeor formula" (10px tertiary). **Updates live** as inputs change.
6. Continue CTA — primary green

**Form validation (Zod):**
```typescript
z.object({
  age: z.number().min(13).max(100),
  sex: z.enum(['male', 'female']),
  height: z.number().min(100).max(250), // cm
  weight: z.number().min(30).max(300),  // kg
  units: z.enum(['metric', 'imperial']),
})
```

**Live calculation:** `calculateBMR(age, sex, height, weight)` from `src/lib/formulas/tdee.ts` fires on every input change via `watch()`.

---

### Screen 3 — Goal & activity

**File:** `app/(onboarding)/goal.tsx`
**Purpose:** Capture goal and activity level; show computed TDEE and protein target.

**Layout:**
1. Progress bar — 2 of 3 filled
2. Screen title — "Goal & activity"
3. Goal selector — 3 option rows. Selected state: `bg-purple-50 border-2 border-brand-purple rounded-lg`. Each row: title (12px/500) + subtitle (10px secondary). Options: Body recomposition / Bulk / Cut
4. Activity level selector — 3–5 rows. Selected state: `bg-teal-50 border border-brand-green`. Each row: label left, multiplier right (10px tertiary). Options: Sedentary ×1.2 / Lightly active ×1.375 / Moderately active ×1.55 / Very active ×1.725 / Extremely active ×1.9
5. Live TDEE + protein card — 2-column grid tile. Left: TDEE in kcal. Right: protein target in grams (purple). **Updates live** as selections change.
6. Continue CTA

**Default selection:** Body recomposition + Moderately active

**Live calculation:** `calculateTDEE(bmr, activityMultiplier)` and `calculateMacroTargets(tdee, goal, weight)` from formulas lib.

---

### Screen 4 — API key

**File:** `app/(onboarding)/api-key.tsx`
**Purpose:** Collect and validate the Anthropic API key; store in SecureStore.

**Layout:**
1. Progress bar — 3 of 3 filled
2. Screen title — "Connect Claude AI"
3. Subtitle — "Powers food scanning, workout plans & coaching"
4. Info card — `bg-purple-50`, `rounded-lg`, `p-10`, purple text, 11px, 2 sentences explaining secure storage
5. API key input — label "Anthropic API key" (10px tertiary), `TextInput` with `secureTextEntry={true}`, masked display, `bg-surface-secondary border rounded-lg p-9 px-11`. Show/hide toggle link on right edge.
6. Get key link — "Get a free key at console.anthropic.com →", 11px, brand blue, right-aligned
7. Validate & Save CTA — primary green
8. **Validation states:**
   - Idle: CTA shows "Validate & save"
   - Loading: CTA replaced with spinner + "Validating…" text, input disabled
   - Success: Green confirmation row appears below CTA — circle dot + "Key validated — you're all set", `bg-teal-50`, `rounded-lg`
   - Error: Red row appears — circle dot + specific error message. Errors: `invalid_key` → "Key was rejected by Anthropic", `network_error` → "Check your connection and try again", `rate_limit` → "Rate limit hit — try again in a moment"
9. Feature unlock card — `bg-surface-secondary`, `rounded-lg`, 3 bullet points listing AI features (10px tertiary label + 11px body)
10. Skip link — "Skip for now (some features unavailable)", 10px, tertiary, centred — calls `clearApiKey()` and navigates to main app

**On success:** calls `saveApiKey(key)`, sets `hasApiKey = true` in ui-store, `router.replace('/(tabs)')`

---

## Main tabs

### Tab 1 — Dashboard (Home)

**File:** `src/features/dashboard/dashboard-screen.tsx`
**Tab icon:** Home
**Purpose:** Daily at-a-glance view of all four pillars.

**Layout:**
1. Header row — greeting left ("Good morning, James"), date + recomp day right. Avatar circle top-right (initials, `bg-teal-100`). Tap avatar → Settings.
2. Calories + Protein tiles — 2-column grid. Each tile: label, large value, "of X" subtitle, 3px progress bar. Calories: green bar. Protein: purple bar. **Protein is always shown even when calories are on track** — it's the primary recomp metric.
3. Macro bar — `bg-surface-secondary`, `rounded-lg`. Single segmented bar (height 7px): protein (purple) / carbs (green) / fat (coral), proportional widths. Colour legend below.
4. AI coach card — `bg-purple-50`, `rounded-lg`, `p-8`. "AI coach · today" label (9px purple/500). One sentence insight (11px purple). Tap → full Coach tab.
5. Mini stats row — 3 tiles: workouts this week / today's weight / water (ml). If water < 2000ml, value shows in coral.
6. Today's workout CTA — `bg-surface-secondary`, `rounded-lg`, `p-7`, "Today's workout" label left, "Push A · start →" right in green. Tap → Workout tab with session auto-started.

**Data sources:**
- Calories/protein: `useLiveQuery` on today's `food_log` rows, summed
- Macros: same query
- AI coach card: today's `coach_entry` from SQLite (cached) or triggers new call if empty
- Workouts: count of `session` rows this week
- Weight: today's `body_metric` row

---

### Tab 2 — Food log

**File:** `src/features/nutrition/nutrition-screen.tsx`
**Tab icon:** Food (circle)
**Purpose:** Log all food for the day; primary entry point for food scanning.

**Layout:**
1. Header row — "Food log" left, "+ add manual" link right (brand blue)
2. Scan CTA — `bg-brand-green`, `rounded-lg`, `p-9 px-12`. Icon (square with rounded corners, white, 24×24) + "Scan food photo" (12px white/500) + "or scan barcode" (9px white/75%). Tap → Camera overlay.
3. Today summary row — `bg-surface-secondary`, `rounded-lg`, `p-7 px-10`. "Today's total" left, "P 142g  1,840 kcal" right.
4. Meal sections — for each meal (Breakfast / Lunch / Dinner / Snacks):
   - Section header: 9px uppercase letter-spaced tertiary label, `mb-5`
   - Food log entry cards: `bg-surface-secondary`, `rounded-lg`, `p-8 px-10`. Left: name (11px/500) + macros row (9px secondary) + confidence badge. Right: kcal (12px/500) + "kcal" (8px tertiary). Long-press → edit/delete action sheet.
   - Empty state: dashed border card, "Not logged yet", 11px tertiary, centred
5. Confidence badges (positioned below the macro row):
   - `●` green 5px + "AI scan · high" (9px green) — `confidence === 'high'`
   - `●` amber 5px + "AI scan · medium" (9px amber) — `confidence === 'medium'`
   - `●` blue 5px + "Barcode scan" (9px blue) — source === 'barcode'
   - No badge — manual entry

**Swipe actions on entries:** Swipe left → red Delete chip. Tap entry → edit modal.

---

### Tab 3 — Workout (active session)

**File:** `src/features/workout/workout-screen.tsx`
**Tab icon:** Activity (square)
**Purpose:** Show the current workout plan day; log sets during a session.

**Two states:** Pre-session (plan view) and In-session (logger).

**Pre-session layout:**
1. Header — "Workout" left, "view full plan" right (blue)
2. Plan card — `bg-surface-secondary`, `rounded-lg`. Name + week + split left. "start" CTA pill right (green).
3. Week progress bar — N segments representing N weeks, filled up to current week.
4. Upcoming exercises list — collapsed cards showing exercise name + sets × reps × weight. All same opacity.
5. Start session button — primary green, full width, "Begin Push A"

**In-session layout:**
1. Header — "Workout" left, session timer right (MM:SS counting up)
2. Plan progress bar — same as above
3. Exercise cards — three visual states:
   - **Done** (`bg-surface-secondary`, no border) — exercise name + `done` green pill badge. Set grid shows logged weight×reps in solid cells with white bg + border. Overload badge if new PR: "+2.5kg from last week" (8px green).
   - **Active** (`bg-amber-50 border border-amber-400`) — exercise name + `active` amber pill badge. Set grid: logged sets in solid white cells with amber border, pending sets as dashed cells with "set N" label. Rest timer text: "rest 90s · last week: X".
   - **Upcoming** (50% opacity, collapsed) — name + "sets × reps · weight" in one line.
4. Complete session button — appears after last set logged. Primary green, "Finish session".

**Set logging interaction:** Tap a pending set cell → inline numeric input (weight + reps). Confirm → cell becomes solid.

---

### Tab 4 — Body metrics

**File:** `src/features/metrics/metrics-screen.tsx`
**Tab icon:** Body (square)
**Purpose:** Track weight, body fat, measurements, and progress photos.

**Layout:**
1. Header — "Body metrics" left, "log today" right (blue)
2. Weight + Body fat tiles — 2-column grid. Weight: value + "↓ N.N this week" (green if down, coral if up). Body fat %: value + monthly delta.
3. 30-day weight trend chart — `bg-surface-secondary`, `rounded-lg`, `p-8`. Title "30-day weight trend" (10px/500). Victory Native line chart, minimal axes, green line, dot at latest point. Date range below. Tap → expand to full 90-day view.
4. Measurements grid — `bg-surface-secondary`, `rounded-lg`, `p-8`. "Measurements (cm)" label. 3-column: Waist / Hip / Arm (+ Chest + Thigh on expand). Each: large value + label + delta arrow (green down for waist, green up for arm).
5. Recomp signal card — `bg-amber-50`, `rounded-lg`, `p-7 px-9`. 9px amber text. One sentence interpreting the data through the recomp lens (generated by formulas, not AI call).
6. Progress photos link row — `bg-surface-secondary`, "Progress photos" left, "view N photos →" right (blue). Tap → photo gallery screen.
7. Log today FAB — floating bottom-right, or inline "Log today" button: opens body check-in modal (weight + optional measurements).

**Recomp signal logic (pure function, no AI):**
```typescript
// src/lib/formulas/recomp-signal.ts
function getRecompSignal(weightDelta: number, waistDelta: number, armDelta: number): string
// weightDelta > 0 && waistDelta < 0 → "Scale up but waist down — recomp working"
// weightDelta < 0 && armDelta > 0 → "Scale down, arm up — lean mass building"
// weightDelta === 0 → "Weight stable — typical recomp plateau, check measurements"
```

---

### Tab 5 — AI coach

**File:** `src/features/coach/coach-screen.tsx`
**Tab icon:** Coach (circle)
**Purpose:** Weekly digest + daily check-in history powered by Claude.

**Layout:**
1. Header — "AI coach" left, "Week N of 8" right (secondary)
2. Weekly summary card — `bg-purple-50`, `rounded-lg`, `p-9`. "This week's summary" label (9px purple/500). 2–3 sentence paragraph (11px purple, line-height 1.55). Generated Sunday, cached in `coach_entry`.
3. Insight cards — 3 cards, each `bg-surface-secondary`, `rounded-lg`, `p-7 px-9`. Left: coloured dot in 14×14 circle. Right: 10px body text. Colours: green (win) / amber (watch) / blue (next action).
4. Weekly stats bar — `bg-surface-secondary`, `rounded-lg`, `p-8`. 4-column grid: protein days / workouts / waist delta / streak.
5. Daily check-ins section — "Daily check-ins" section header. Scrollable list of past days: day name left, 9px summary right (green if good day, amber if off-track).
6. Refresh button (subtle) — only shown if digest is older than 7 days. "Regenerate digest" link, 10px blue.

**Caching logic:**
- `coach_entry` table has `date` and `content` columns
- On screen mount: check if today's entry exists → render cached
- If no entry for today AND it's a new day: trigger `useCoach()` mutation
- Weekly digest: generated on Sunday, keyed by week number, never regenerated mid-week

---

## Overlay screens

### Overlay 1 — Food scan camera

**File:** `src/features/nutrition/food-scan-screen.tsx`
**Triggered by:** "Scan food photo" CTA on Food tab
**Presentation:** Full-screen modal (no tab bar)

**Layout:**
- Full black background (`bg-black`)
- Status bar: white icons
- Top bar: "Scan food" (12px white/500) left, "✕ cancel" (11px white/60%) right, `px-14`, `pt-0`
- Viewfinder — centred, 150×150px. Semi-transparent border `border-zinc-700`. Green corner brackets (20×20px each corner, 2.5px stroke, brand green). Inside: optional food placeholder tint.
- Instruction text — "Centre food in frame · Claude will identify and estimate macros", 9px white/50%, centred, above shutter row
- Bottom action row — centred, `gap-6`:
  - Left: "barcode" pill button (`bg-white/15 text-white`)
  - Centre: shutter button — 52px circle white, inner 38px circle with `border-2 border-black`. Tap → capture.
  - Right: "manual" pill button

**States:**
- Idle: viewfinder visible, shutter enabled
- Capturing: brief flash animation, shutter disabled
- Processing: spinner overlaid on viewfinder, "Identifying food…" text appears

**Navigation:** On successful scan → replace with Confirm result screen. Cancel → `router.back()`.

---

### Overlay 2 — Scan confirm result

**File:** `src/features/nutrition/food-scan-confirm.tsx`
**Presented:** After successful camera capture + Claude response

**Layout:**
1. Header — "Confirm scan result" (13px/500) left, "retake" (10px blue) right
2. Photo thumbnail — `h-80`, `rounded-xl`, dark background, food shape placeholder. Confidence badge overlaid bottom-right.
3. Result card — `bg-teal-50`, `rounded-lg`, `p-9`. Food name (12px teal/500). 4-column macro grid: kcal / protein / carbs / fat — each has large value (14px/500 teal) and label (8px teal).
4. Adjust hint — "Adjust values if needed", 10px tertiary
5. Portion + meal row — 2-column: Meal selector (Breakfast/Lunch/Dinner/Snack) + Portion selector (0.5×/1×/1.5×/2×). Both `bg-surface-secondary rounded-lg p-6 px-8`.
6. Action row — 2 columns: "Edit values" (secondary) + "Log this" (primary green).
7. Attribution text — 9px tertiary, centred, below buttons: "Claude identified this as [food] with ~[N]% confidence. Portion estimated from image size."

**Edit values flow:** Tapping "Edit values" turns the result card fields into inline text inputs.

**Confidence badge colours on thumbnail:**
- High: `bg-brand-green text-white`
- Medium: `bg-amber text-white`
- Low: `bg-coral text-white` + extra nudge text "Consider verifying"

---

### Overlay 3 — Body fat calculator

**File:** `src/features/metrics/body-fat-form.tsx`
**Triggered by:** "Log today" on Body tab → choose body fat
**Presentation:** Bottom sheet modal

**Layout:**
1. Header — "Body fat calculator" (13px/500), "US Navy method" (10px secondary)
2. Measurement inputs — `bg-surface-secondary border rounded-lg p-8 px-10` for each:
   - Waist (cm)
   - Neck (cm)
   - *Females only:* Hip (cm) — conditional field, shown when `profile.sex === 'female'`
   - Height (cm) — pre-filled from profile, non-editable (shows padlock icon)
3. Instruction card — `bg-amber-50 rounded-lg p-7 px-9`, 9px amber: "Measure waist at navel level. Neck at narrowest point below larynx. Stand straight."
4. Result card — `bg-purple-50 rounded-lg p-10`, centred. Label "Estimated body fat" (9px purple). Large value (28px/500 purple). Lean mass + fat mass (9px purple). Category label (9px purple).
5. Action row — "Recalculate" (secondary) + "Save to log" (primary purple). Purple used here instead of green to match the body fat / metrics colour language.

**Live calculation:** fires `calculateBodyFat(waist, neck, height, sex)` on every input change.

**Category thresholds (male):**
- Essential fat: < 6%
- Athletic: 6–13%
- Fitness: 14–20%
- Average: 21–24%
- Obese: ≥ 25%

---

### Overlay 4 — Workout plan generator

**File:** `src/features/workout/plan-generator.tsx`
**Triggered by:** "Generate plan" CTA or empty state on Workout tab
**Presentation:** Bottom sheet modal

**Layout:**
1. Header — "Generate workout plan" (13px/500), "Claude will build a personalised plan" (10px secondary)
2. Training split — 3-column pill row: PPL / Upper-Lower / Full body. Selected: `bg-purple-50 border border-brand-purple` with purple text. Unselected: `bg-surface-secondary`.
3. Days per week — stepper row (– / N / +) or `bg-surface-secondary` field. Range 2–6.
4. Experience level — `bg-surface-secondary` field. Options: Beginner / Intermediate / Advanced.
5. Equipment chips — Horizontal wrap of chip pills. Selected: `bg-teal-50 text-teal-800`. Unselected: `bg-surface-secondary`. "+ add" chip at end → text input for custom equipment.
6. Plan duration — `bg-surface-secondary` field. Options: 4 weeks / 6 weeks / 8 weeks / 12 weeks.
7. Generate CTA — primary green, "Generate plan with Claude"
8. Footer note — "Takes ~5 seconds · uses your recomp goal + profile", 9px tertiary, centred

**Loading state (after tap):**
- Button replaced with: spinner + "Claude is building your plan…"
- Estimated time shown: "Usually under 10 seconds"

**Success state:**
- Modal slides down, workout tab refreshes to show new plan
- Brief success toast: "Push Pull Legs plan generated — 8 weeks, 4 days/week"

**Pre-fills from profile:** equipment from `profile.equipment`, days from `profile.daysPerWeek` (set during onboarding), experience from `profile.experience`.

---

### Overlay 5 — Settings

**File:** `src/features/settings/settings-screen.tsx`
**Triggered by:** Tap on avatar in dashboard header
**Presentation:** Pushed screen (not modal)

**Layout — grouped list sections:**

**Section: AI**
- "Anthropic API key" row — value: masked `sk-ant-api03-••••••••••••`, right: "update" (blue). Tap → API key update modal.
- "Model" row — value: `claude-sonnet-4-6`, right: dash (not editable, informational only).

**Section: Profile**
- "Edit profile" row → `app/onboarding/profile` re-opened in edit mode
- "Units" row → Metric / Imperial picker
- "Notifications" row → toggle. On: green. Off: zinc.

**Section: Data**
- "Export all data" row → generates JSON export of all SQLite tables, triggers share sheet
- "Remove API key" row — text in `text-coral` (danger colour). Tap → confirmation alert: "This will remove your API key and disable AI features. Continue?" → on confirm: `clearApiKey()`, navigate to onboarding api-key step.

**API key update modal:**
- Same input + validate flow as onboarding step 4
- On success: shows "Key updated" inline confirmation, modal auto-dismisses after 1.5s

---

## Error & empty states

### No API key (post-onboarding)

When `hasApiKey === false` and user attempts an AI action:

**Banner component** (shown inline above the relevant CTA):
```
bg-purple-50, rounded-lg, p-8 px-10
"AI features need an API key"  (11px purple/500)
[Configure in Settings]         (11px blue, tap → settings/api-key)
```

Non-AI features (manual food entry, metric logging, workout logging) remain fully functional.

### API key invalid / expired

When Claude API returns 401:

**Banner** (same style as above):
```
"API key was rejected — it may have expired"  (11px purple/500)
[Update key in Settings]                       (11px blue)
```

### Scan failed

When Claude vision returns low-confidence or unparseable result:

**Confirm screen** shows with `confidence === 'low'` badge + amber card instead of green:
```
bg-amber-50, rounded-lg
"Could not confidently identify this food. Please adjust values before logging."
```
All fields editable. "Log manually" CTA instead of "Log this".

### Empty states (first-time screens)

| Screen | Empty state |
|---|---|
| Food log (no entries) | Dashed card + "Tap 'Scan food photo' to log your first meal" |
| Workout tab (no plan) | Centred card: "No plan yet" + "Generate your first plan →" CTA |
| Body metrics (no entries) | "Log your first weigh-in" CTA |
| Coach (no entries) | "Start logging food and workouts to unlock coaching" |
| Progress photos | Grid placeholder + "Take your first photo" CTA |

---

## Screen inventory

| # | Screen | File | Type | Status |
|---|---|---|---|---|
| 1 | Welcome | `app/(onboarding)/index.tsx` | Full screen | Phase 0 |
| 2 | Profile — basic info | `app/(onboarding)/profile.tsx` | Full screen | Phase 1 |
| 3 | Goal & activity | `app/(onboarding)/goal.tsx` | Full screen | Phase 1 |
| 4 | API key setup | `app/(onboarding)/api-key.tsx` | Full screen | Phase 0 |
| 5 | Dashboard | `app/(tabs)/index.tsx` | Tab | Phase 1 |
| 6 | Food log | `app/(tabs)/food.tsx` | Tab | Phase 2 |
| 7 | Food scan camera | `app/(tabs)/food/scan.tsx` | Full-screen modal | Phase 2 |
| 8 | Scan confirm result | `app/(tabs)/food/confirm.tsx` | Full-screen modal | Phase 2 |
| 9 | Workout | `app/(tabs)/workout.tsx` | Tab | Phase 3 |
| 10 | Plan generator | `app/(tabs)/workout/generate.tsx` | Bottom sheet | Phase 3 |
| 11 | Body metrics | `app/(tabs)/body.tsx` | Tab | Phase 1 |
| 12 | Body fat calculator | `app/(tabs)/body/body-fat.tsx` | Bottom sheet | Phase 1 |
| 13 | AI coach | `app/(tabs)/coach.tsx` | Tab | Phase 4 |
| 14 | Settings | `app/settings/index.tsx` | Pushed screen | Phase 0 |
| 15 | API key update | `app/settings/api-key.tsx` | Modal | Phase 0 |
| 16 | Progress photos | `app/(tabs)/body/photos.tsx` | Pushed screen | Phase 4 |

---

## Interaction patterns

### Form inputs

All text inputs use react-hook-form + Zod. Pattern:
1. Field label (10px tertiary, `mb-3`)
2. Input (`bg-surface-secondary border rounded-lg p-8 px-10`, 13px/500)
3. Error message (10px coral, `mt-2`) — only shown after first blur
4. Live computed result card (updates on every valid keystroke)

### Loading states

- AI calls: spinner replaces CTA button. Button width preserved to avoid layout shift.
- Data queries: skeleton shimmer on metric tiles (pulse animation on `bg-surface-secondary` rect)
- Charts: `ActivityIndicator` centred in chart container while data loads

### Confirmation patterns

- Destructive actions (delete food entry, remove API key): `Alert.alert()` with Cancel + destructive action
- Successful saves: inline confirmation row with green dot + text. Auto-dismisses after 1.5s.
- Navigation after success: `router.back()` for modals, `router.replace()` for onboarding completion

---

*Last updated: April 2026. Generated as part of HealthOS UX planning session.*
*Reference this document alongside `HEALTHOS_PROJECT_GUIDE.md` when building any screen.*
