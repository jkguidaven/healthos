import { calculateMacroTargets } from '../macros'

describe('calculateMacroTargets', () => {
  describe('recomposition', () => {
    it('returns expected targets for 80kg at 2400 TDEE', () => {
      const result = calculateMacroTargets(2400, 80, 'recomposition')
      // protein: 80 * 2.2 = 176g
      // fat: 2400 * 0.25 / 9 = 66.67 → 67g
      // protein kcal: 176*4 = 704
      // fat kcal: 66.67 * 9 = 600
      // carbs kcal: 2400 - 704 - 600 = 1096
      // carbs g: 1096 / 4 = 274
      expect(result.calories).toBe(2400)
      expect(result.proteinG).toBe(176)
      expect(result.fatG).toBe(67)
      expect(result.carbsG).toBe(274)
    })

    it('keeps calories equal to TDEE', () => {
      const result = calculateMacroTargets(2200, 70, 'recomposition')
      expect(result.calories).toBe(2200)
    })

    it('protein scales with bodyweight', () => {
      const heavy = calculateMacroTargets(3000, 100, 'recomposition')
      const light = calculateMacroTargets(3000, 60, 'recomposition')
      expect(heavy.proteinG).toBe(220) // 100 * 2.2
      expect(light.proteinG).toBe(132) // 60 * 2.2
    })

    it('macro calories roughly sum to total calories', () => {
      const result = calculateMacroTargets(2400, 80, 'recomposition')
      const sum =
        result.proteinG * 4 + result.carbsG * 4 + result.fatG * 9
      // Rounding may introduce +/- a few kcal
      expect(Math.abs(sum - result.calories)).toBeLessThanOrEqual(5)
    })
  })

  describe('bulk', () => {
    it('adds 250 kcal surplus above TDEE', () => {
      const result = calculateMacroTargets(2400, 80, 'bulk')
      expect(result.calories).toBe(2650)
    })

    it('uses the same protein per kg as recomp', () => {
      const result = calculateMacroTargets(2400, 80, 'bulk')
      expect(result.proteinG).toBe(176) // 80 * 2.2
    })

    it('fat grams scale with surplus calories', () => {
      const recomp = calculateMacroTargets(2400, 80, 'recomposition')
      const bulk = calculateMacroTargets(2400, 80, 'bulk')
      expect(bulk.fatG).toBeGreaterThan(recomp.fatG)
    })

    it('carbs are higher than recomp due to surplus', () => {
      const recomp = calculateMacroTargets(2400, 80, 'recomposition')
      const bulk = calculateMacroTargets(2400, 80, 'bulk')
      expect(bulk.carbsG).toBeGreaterThan(recomp.carbsG)
    })
  })

  describe('cut', () => {
    it('subtracts 350 kcal deficit from TDEE', () => {
      const result = calculateMacroTargets(2400, 80, 'cut')
      expect(result.calories).toBe(2050)
    })

    it('uses higher protein target (2.4 g/kg)', () => {
      const result = calculateMacroTargets(2400, 80, 'cut')
      expect(result.proteinG).toBe(192) // 80 * 2.4
    })

    it('carbs are lower than recomp due to deficit', () => {
      const recomp = calculateMacroTargets(2400, 80, 'recomposition')
      const cut = calculateMacroTargets(2400, 80, 'cut')
      expect(cut.carbsG).toBeLessThan(recomp.carbsG)
    })

    it('returns expected full target for 70kg cut at 2200 TDEE', () => {
      const result = calculateMacroTargets(2200, 70, 'cut')
      // calories: 2200 - 350 = 1850
      // protein: 70 * 2.4 = 168
      // fat: 1850 * 0.25 / 9 = 51.39 → 51
      // protein kcal: 168*4 = 672
      // fat kcal: 51.39*9 = 462.5
      // carbs kcal: 1850 - 672 - 462.5 = 715.5
      // carbs g: 715.5 / 4 = 178.875 → 179
      expect(result.calories).toBe(1850)
      expect(result.proteinG).toBe(168)
      expect(result.fatG).toBe(51)
      expect(result.carbsG).toBe(179)
    })
  })

  describe('integer rounding', () => {
    it('all macro values are integers', () => {
      const result = calculateMacroTargets(2413, 77.5, 'recomposition')
      expect(Number.isInteger(result.calories)).toBe(true)
      expect(Number.isInteger(result.proteinG)).toBe(true)
      expect(Number.isInteger(result.carbsG)).toBe(true)
      expect(Number.isInteger(result.fatG)).toBe(true)
    })
  })
})
