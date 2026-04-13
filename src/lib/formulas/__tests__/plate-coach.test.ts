import {
  computePlateCoach,
  type PlateCoachInput,
  type PlateCoachRecentFood,
} from '../plate-coach'

const greekYogurt: PlateCoachRecentFood = {
  name: 'Greek yogurt (0%)',
  calories: 150,
  proteinG: 25,
  carbsG: 8,
  fatG: 0,
}
const chickenBreast: PlateCoachRecentFood = {
  name: 'Grilled chicken breast',
  calories: 280,
  proteinG: 50,
  carbsG: 0,
  fatG: 6,
}
const rice: PlateCoachRecentFood = {
  name: 'Jasmine rice',
  calories: 400,
  proteinG: 6,
  carbsG: 88,
  fatG: 1,
}
const cheesePizza: PlateCoachRecentFood = {
  name: 'Cheese pizza slice',
  calories: 850,
  proteinG: 30,
  carbsG: 90,
  fatG: 38,
}

function baseInput(overrides: Partial<PlateCoachInput> = {}): PlateCoachInput {
  return {
    hour: 14,
    hasProfile: true,
    goalCalories: 2400,
    goalProteinG: 170,
    todayCalories: 1200,
    todayProteinG: 90,
    mealsLogged: 2,
    loggedSlots: new Set(['breakfast', 'lunch']),
    recentFoods: [greekYogurt, chickenBreast, rice],
    ...overrides,
  }
}

describe('computePlateCoach', () => {
  it('returns an onboarding prompt when the profile is missing', () => {
    const out = computePlateCoach(baseInput({ hasProfile: false }))
    expect(out.rule).toBe('no-profile')
    expect(out.suggestions).toEqual([])
  })

  describe('nothing logged', () => {
    const empty = {
      mealsLogged: 0,
      todayCalories: 0,
      todayProteinG: 0,
      loggedSlots: new Set<never>(),
    }

    it('gives a morning start prompt before 11', () => {
      const out = computePlateCoach(baseInput({ ...empty, hour: 8 }))
      expect(out.rule).toBe('no-meals-morning')
      expect(out.tone).toBe('empty')
      expect(out.suggestions).toEqual([])
    })

    it('escalates by midday', () => {
      const out = computePlateCoach(baseInput({ ...empty, hour: 14 }))
      expect(out.rule).toBe('no-meals-midday')
    })

    it('escalates again in the evening', () => {
      const out = computePlateCoach(baseInput({ ...empty, hour: 20 }))
      expect(out.rule).toBe('no-meals-evening')
    })
  })

  describe('protein very behind in the evening', () => {
    it('fires and ranks recent foods by protein density', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 20,
          todayCalories: 1400,
          todayProteinG: 80, // 80/170 ≈ 47%
          mealsLogged: 3,
        }),
      )
      expect(out.rule).toBe('protein-very-behind-evening')
      expect(out.tone).toBe('behind')
      expect(out.headline).toMatch(/90g short/i)
      expect(out.suggestions.length).toBeGreaterThan(0)
      // Chicken breast (50g / 280kcal = 0.179 g/kcal) beats greek yogurt
      // (25g / 150kcal = 0.167 g/kcal); rice is filtered out (too little
      // protein).
      expect(out.suggestions[0].name).toBe('Grilled chicken breast')
      expect(out.suggestions.map((s) => s.name)).not.toContain('Jasmine rice')
    })

    it('falls back to a generic nudge when no viable foods exist', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 20,
          todayCalories: 1400,
          todayProteinG: 80,
          mealsLogged: 3,
          recentFoods: [rice],
        }),
      )
      expect(out.rule).toBe('protein-very-behind-evening')
      expect(out.suggestions).toEqual([])
      expect(out.detail).toMatch(/shake|yogurt|cottage/i)
    })
  })

  describe('protein behind in the afternoon', () => {
    it('steers dinner without alarming', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 16,
          todayCalories: 900,
          todayProteinG: 60, // 60/170 ≈ 35%
          mealsLogged: 2,
        }),
      )
      expect(out.rule).toBe('protein-behind-afternoon')
      expect(out.tone).toBe('behind')
      expect(out.suggestions.length).toBeGreaterThan(0)
    })
  })

  describe('calorie over', () => {
    it('fires when significantly over goal, with no suggestions', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 21,
          todayCalories: 3000, // 2400 goal, +25%
          todayProteinG: 180,
          mealsLogged: 4,
        }),
      )
      expect(out.rule).toBe('calories-way-over')
      expect(out.tone).toBe('over')
      expect(out.suggestions).toEqual([])
      expect(out.detail).toMatch(/tomorrow|settle|trend/i)
    })
  })

  describe('dialled-in', () => {
    it('collapses to a compliment pill when all targets hit', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 21,
          todayCalories: 2400,
          todayProteinG: 172,
          mealsLogged: 4,
        }),
      )
      expect(out.rule).toBe('dialled-in')
      expect(out.tone).toBe('ahead')
      expect(out.collapsed).toBe(true)
    })
  })

  describe('on-track', () => {
    it('returns a morning on-track state with no suggestions', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 10,
          todayCalories: 500,
          todayProteinG: 40,
          mealsLogged: 1,
        }),
      )
      expect(out.rule).toBe('on-track-morning')
      expect(out.suggestions).toEqual([])
    })

    it('returns an evening on-track state with up to 2 suggestions', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 18,
          todayCalories: 1600,
          todayProteinG: 110, // 65% — above behind threshold
          mealsLogged: 3,
          recentFoods: [greekYogurt, chickenBreast, cheesePizza, rice],
        }),
      )
      expect(out.rule).toBe('on-track-evening')
      expect(out.suggestions.length).toBeLessThanOrEqual(2)
    })
  })

  describe('calorie budget fit', () => {
    it('prefers foods that fit the remaining calorie budget', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 20,
          todayCalories: 2200, // only 200 kcal left
          todayProteinG: 70,
          mealsLogged: 3,
          recentFoods: [chickenBreast, greekYogurt, cheesePizza],
        }),
      )
      // Greek yogurt (150 kcal) fits, chicken (280) and pizza (850) don't.
      expect(out.suggestions[0].name).toBe('Greek yogurt (0%)')
    })

    it('still suggests high-protein foods when nothing fits, but warns', () => {
      const out = computePlateCoach(
        baseInput({
          hour: 20,
          todayCalories: 2350,
          todayProteinG: 70,
          mealsLogged: 3,
          recentFoods: [chickenBreast, cheesePizza],
        }),
      )
      expect(out.suggestions.length).toBeGreaterThan(0)
      expect(out.suggestions[0].reason).toMatch(/halve/i)
    })
  })
})
