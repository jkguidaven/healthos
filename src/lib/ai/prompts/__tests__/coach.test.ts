import {
  buildCoachPrompt,
  CoachResultSchema,
  COACH_SYSTEM_PROMPT,
  type CoachContext,
  type CoachResult,
} from '../coach'

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

const fullContext: CoachContext = {
  profile: {
    sex: 'male',
    age: 30,
    weightKg: 78,
    goalCalories: 2400,
    goalProteinG: 172,
    goalCarbsG: 250,
    goalFatG: 70,
    experienceLevel: 'intermediate',
  },
  todayNutrition: {
    calories: 1850,
    proteinG: 145,
    carbsG: 180,
    fatG: 60,
    waterMl: 2200,
    mealsLogged: 3,
  },
  weekNutritionAvg: {
    caloriesAvg: 2300,
    proteinGAvg: 160,
    daysProteinHit: 5,
    daysLogged: 7,
  },
  lastWorkout: {
    sessionName: 'Push A',
    date: '2026-04-09',
    daysAgo: 2,
    exerciseCount: 6,
    anyPRs: true,
  },
  weekWorkouts: { count: 3, targetCount: 4 },
  bodyMetrics: {
    weightKgLatest: 78.3,
    weightKg30dAgo: 78.0,
    waistCmLatest: 82.5,
    waistCm30dAgo: 83.0,
    bodyFatPctLatest: 17.2,
    bodyFatPct30dAgo: 17.8,
  },
  streaks: { loggingStreak: 12, workoutStreak: 4 },
  todayIsTrainingDay: true,
  currentWeekOfPlan: 5,
}

const emptyContext: CoachContext = {
  profile: {
    sex: 'female',
    age: 28,
    weightKg: 62,
    goalCalories: 1900,
    goalProteinG: 124,
    goalCarbsG: 210,
    goalFatG: 55,
    experienceLevel: 'beginner',
  },
  todayNutrition: null,
  weekNutritionAvg: null,
  lastWorkout: null,
  weekWorkouts: { count: 0, targetCount: 3 },
  bodyMetrics: null,
  streaks: { loggingStreak: 0, workoutStreak: 0 },
  todayIsTrainingDay: false,
  currentWeekOfPlan: null,
}

// ─────────────────────────────────────────────────────────────
// System prompt — sanity guards on the contract with Gemini.
// ─────────────────────────────────────────────────────────────

describe('COACH_SYSTEM_PROMPT', () => {
  it('mentions every required output field', () => {
    expect(COACH_SYSTEM_PROMPT).toContain('message')
    expect(COACH_SYSTEM_PROMPT).toContain('insights')
    expect(COACH_SYSTEM_PROMPT).toContain('action_items')
    expect(COACH_SYSTEM_PROMPT).toContain('mood')
    expect(COACH_SYSTEM_PROMPT).toContain('weekly_highlight')
  })

  it('lists the only allowed mood values', () => {
    expect(COACH_SYSTEM_PROMPT).toContain('"great"')
    expect(COACH_SYSTEM_PROMPT).toContain('"good"')
    expect(COACH_SYSTEM_PROMPT).toContain('"check_in"')
  })

  it('warns the model never to treat scale weight as the primary metric', () => {
    expect(COACH_SYSTEM_PROMPT.toLowerCase()).toContain('scale weight')
  })
})

// ─────────────────────────────────────────────────────────────
// buildCoachPrompt — serializer behaviour.
// ─────────────────────────────────────────────────────────────

describe('buildCoachPrompt', () => {
  it('renders all sections for a fully-populated context', () => {
    const prompt = buildCoachPrompt(fullContext)
    expect(prompt).toContain('=== USER CONTEXT ===')
    expect(prompt).toContain("=== TODAY'S NUTRITION ===")
    expect(prompt).toContain("=== THIS WEEK'S NUTRITION ===")
    expect(prompt).toContain('=== WORKOUTS ===')
    expect(prompt).toContain('=== BODY METRICS (30-day comparison) ===')
    expect(prompt).toContain('=== STREAKS ===')
  })

  it('includes profile, goals, and current week', () => {
    const prompt = buildCoachPrompt(fullContext)
    expect(prompt).toContain('male, 30yo, 78kg')
    expect(prompt).toContain('2400kcal / P172g C250g F70g')
    expect(prompt).toContain('Currently in week 5 of their plan')
    expect(prompt).toContain('Today is a training day')
  })

  it('formats today nutrition when meals are logged', () => {
    const prompt = buildCoachPrompt(fullContext)
    expect(prompt).toContain('1850kcal / P145g C180g F60g')
    expect(prompt).toContain('Water: 2200ml')
    expect(prompt).toContain('Meals logged: 3')
  })

  it('renders the empty-state copy when nothing is logged today', () => {
    const prompt = buildCoachPrompt(emptyContext)
    expect(prompt).toContain('Nothing logged today yet')
    expect(prompt).toContain('No nutrition data this week')
    expect(prompt).toContain('No recent workout logged')
    expect(prompt).toContain('No body metrics logged')
  })

  it('treats a row with mealsLogged === 0 as empty', () => {
    const ctx: CoachContext = {
      ...fullContext,
      todayNutrition: {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        waterMl: 0,
        mealsLogged: 0,
      },
    }
    expect(buildCoachPrompt(ctx)).toContain('Nothing logged today yet')
  })

  it('reports the rest-day flag and missing plan', () => {
    const prompt = buildCoachPrompt(emptyContext)
    expect(prompt).toContain('Today is a rest day')
    expect(prompt).toContain('No active plan')
  })

  it('includes the 30-day deltas in body metric comparisons', () => {
    const prompt = buildCoachPrompt(fullContext)
    // weight: 78 → 78.3 = +0.3kg
    expect(prompt).toMatch(/Weight: 78kg → 78\.3kg \(0\.3kg change\)/)
    // waist: 83 → 82.5 = -0.5cm
    expect(prompt).toMatch(/Waist: 83cm → 82\.5cm \(-0\.5cm change\)/)
    // body fat: 17.8 → 17.2 = -0.6%
    expect(prompt).toMatch(/Body fat: 17\.8% → 17\.2% \(-0\.6% change\)/)
  })

  it('omits body metric lines that have null fields', () => {
    const ctx: CoachContext = {
      ...fullContext,
      bodyMetrics: {
        weightKgLatest: 78,
        weightKg30dAgo: 77.5,
        waistCmLatest: null,
        waistCm30dAgo: null,
        bodyFatPctLatest: null,
        bodyFatPct30dAgo: null,
      },
    }
    const prompt = buildCoachPrompt(ctx)
    expect(prompt).toContain('Weight: 77.5kg → 78kg')
    expect(prompt).not.toContain('Waist:')
    expect(prompt).not.toContain('Body fat:')
  })

  it('reports streaks and workout target', () => {
    const prompt = buildCoachPrompt(fullContext)
    expect(prompt).toContain('Food logging streak: 12 days')
    expect(prompt).toContain('Workout streak: 4 weeks')
    expect(prompt).toContain('This week: 3/4 sessions completed')
  })
})

// ─────────────────────────────────────────────────────────────
// CoachResultSchema — runtime validation guards on Gemini output.
// ─────────────────────────────────────────────────────────────

describe('CoachResultSchema', () => {
  const validResult: CoachResult = {
    message:
      'Scale is up 0.3kg this week but your waist is down 0.5cm — that is the recomposition signal working exactly as it should.',
    insights: [
      'Protein hit 5 out of 7 days this week — solid consistency for recomp',
      'Bench press added 2.5kg from last session — progressive overload on track',
      'Calories averaged slightly under goal on rest days — this is fine for recomp',
    ],
    action_items: [
      'Add a protein shake today to hit your 172g target',
      'Next push session: attempt 82.5kg on bench if last set felt clean',
    ],
    mood: 'great',
    weekly_highlight:
      'You hit a bench press PR this week — strength gain is the clearest sign lean mass is building.',
  }

  it('accepts the canonical example from ai-prompts.md', () => {
    expect(() => CoachResultSchema.parse(validResult)).not.toThrow()
  })

  it('rejects an unknown mood value', () => {
    expect(() =>
      CoachResultSchema.parse({ ...validResult, mood: 'bad' }),
    ).toThrow()
  })

  it('rejects an empty insights array', () => {
    expect(() =>
      CoachResultSchema.parse({ ...validResult, insights: [] }),
    ).toThrow()
  })

  it('rejects an empty action_items array', () => {
    expect(() =>
      CoachResultSchema.parse({ ...validResult, action_items: [] }),
    ).toThrow()
  })

  it('rejects a too-short message', () => {
    expect(() =>
      CoachResultSchema.parse({ ...validResult, message: 'short' }),
    ).toThrow()
  })

  it('rejects more than 5 insights', () => {
    expect(() =>
      CoachResultSchema.parse({
        ...validResult,
        insights: Array(6).fill('this is a perfectly valid insight string'),
      }),
    ).toThrow()
  })
})
