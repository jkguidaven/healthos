import { deriveCoachHint, type CoachHintInput } from '../coach-hint'

const baseInput: CoachHintInput = {
  hour: 14,
  hasProfile: true,
  goalCalories: 2400,
  goalProteinG: 170,
  todayCalories: 1500,
  todayProteinG: 110,
  mealsLogged: 3,
  todayWaterMl: 1800,
  waterTarget: 2500,
  workoutsThisWeek: 2,
  workoutTarget: 4,
  dayOfWeek: 3,
  cachedCoachMessage: null,
}

describe('deriveCoachHint', () => {
  describe('no profile', () => {
    it('nudges to finish onboarding', () => {
      const hint = deriveCoachHint({ ...baseInput, hasProfile: false })
      expect(hint.rule).toBe('no-profile')
      expect(hint.message).toMatch(/profile/i)
    })
  })

  describe('nothing logged today', () => {
    const empty = {
      ...baseInput,
      mealsLogged: 0,
      todayCalories: 0,
      todayProteinG: 0,
    }

    it('shows a friendly morning prompt', () => {
      const hint = deriveCoachHint({ ...empty, hour: 8 })
      expect(hint.rule).toBe('no-meals-morning')
      expect(hint.tone).toBe('neutral')
    })

    it('escalates by midday', () => {
      const hint = deriveCoachHint({ ...empty, hour: 13 })
      expect(hint.rule).toBe('no-meals-midday')
      expect(hint.tone).toBe('nudge')
    })

    it('escalates again in the evening', () => {
      const hint = deriveCoachHint({ ...empty, hour: 19 })
      expect(hint.rule).toBe('no-meals-evening')
      expect(hint.tone).toBe('watch')
    })
  })

  describe('protein deficit', () => {
    it('flags an evening protein gap with a concrete number', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 19,
        todayProteinG: 80, // 80/170 = 47%
      })
      expect(hint.rule).toBe('protein-very-behind-evening')
      expect(hint.message).toMatch(/90g/)
    })

    it('flags an afternoon protein gap with a percentage', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 16,
        todayProteinG: 60, // 35%
      })
      expect(hint.rule).toBe('protein-behind-afternoon')
      expect(hint.message).toMatch(/35%/)
    })

    it('does not fire in the morning even when protein is low', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 9,
        todayProteinG: 20,
      })
      expect(hint.rule).not.toMatch(/protein/)
    })
  })

  describe('calories over goal', () => {
    it('warns when more than 20% over target', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 19,
        todayCalories: 3000, // 25% over 2400
        todayProteinG: 180, // protein hit so it doesn't short-circuit
      })
      expect(hint.rule).toBe('calories-way-over')
      expect(hint.message).toMatch(/600kcal/)
    })

    it('does not fire when only marginally over', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 19,
        todayCalories: 2500,
        todayProteinG: 180,
      })
      expect(hint.rule).not.toBe('calories-way-over')
    })
  })

  describe('workouts', () => {
    it('celebrates hitting the weekly target', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        workoutsThisWeek: 4,
        workoutTarget: 4,
        todayProteinG: 180, // make sure protein doesn't short-circuit
      })
      expect(hint.rule).toBe('workouts-target-hit')
      expect(hint.tone).toBe('win')
    })

    it('warns when no workouts logged on Friday', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        workoutsThisWeek: 0,
        workoutTarget: 4,
        dayOfWeek: 5,
        todayProteinG: 180,
      })
      expect(hint.rule).toBe('workouts-missed-week-end')
      expect(hint.tone).toBe('watch')
    })

    it('does not warn when no workouts logged on a Tuesday', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        workoutsThisWeek: 0,
        workoutTarget: 4,
        dayOfWeek: 2,
        todayProteinG: 180,
      })
      expect(hint.rule).not.toBe('workouts-missed-week-end')
    })
  })

  describe('water', () => {
    it('nudges in the evening when water is below 60%', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 19,
        todayWaterMl: 1200, // 48%
        todayProteinG: 180,
      })
      expect(hint.rule).toBe('water-behind-evening')
    })

    it('stays quiet in the afternoon', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 14,
        todayWaterMl: 600,
        todayProteinG: 180,
      })
      expect(hint.rule).not.toBe('water-behind-evening')
    })
  })

  describe('dialled-in day', () => {
    it('celebrates hitting protein and being on calories', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 19,
        todayCalories: 2350,
        todayProteinG: 175,
        mealsLogged: 4,
      })
      expect(hint.rule).toBe('macros-dialled-in')
      expect(hint.tone).toBe('win')
    })
  })

  describe('cached coach message fallback', () => {
    it('uses the cached AI message when no rule fires', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 12,
        todayCalories: 1800,
        todayProteinG: 130, // 76% — not flagged
        cachedCoachMessage:
          'Scale is up 0.3kg this week but your waist is down — recomp signal is working. Keep at it.',
      })
      expect(hint.rule).toBe('cached-coach-message')
      expect(hint.message).toMatch(/Scale is up 0\.3kg/)
      // Should be trimmed to one sentence.
      expect(hint.message).not.toMatch(/Keep at it/)
    })
  })

  describe('default fallback', () => {
    it('uses returning-default when no rule fires and no cached message', () => {
      const hint = deriveCoachHint({
        ...baseInput,
        hour: 12,
        todayCalories: 1800,
        todayProteinG: 130, // not flagged
      })
      expect(hint.rule).toBe('returning-default')
    })
  })
})
