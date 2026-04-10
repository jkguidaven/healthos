import {
  BODY_FAT_CATEGORY_LABEL,
  calculateBodyFat,
  getBodyFatCategory,
} from '../body-fat'

describe('calculateBodyFat', () => {
  describe('male inputs', () => {
    it('returns expected result for standard male measurements', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 90, neckCm: 38 },
        80,
      )
      expect(result).not.toBeNull()
      // Navy formula for these inputs yields ~18% body fat
      expect(result!.bodyFatPct).toBeGreaterThan(15)
      expect(result!.bodyFatPct).toBeLessThan(22)
      expect(result!.category).toBe('fitness')
    })

    it('returns athletic category for lean male', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 180, waistCm: 80, neckCm: 39 },
        78,
      )
      expect(result).not.toBeNull()
      // ~10% body fat
      expect(result!.category).toBe('athletic')
    })

    it('returns null when waist equals neck (physiologically invalid)', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 40, neckCm: 40 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null when waist is less than neck', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 41, neckCm: 45 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly short height', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 50, waistCm: 82, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly tall height', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 300, waistCm: 82, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly small waist', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 30, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly large waist', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 220, neckCm: 38 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly small neck', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 82, neckCm: 15 },
        78,
      )
      expect(result).toBeNull()
    })

    it('returns null for implausibly large neck', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 82, neckCm: 90 },
        78,
      )
      expect(result).toBeNull()
    })

    it('clamps body fat percent to at least 3%', () => {
      // Extreme lean male: narrow waist relative to neck produces very low bf%.
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 200, waistCm: 60, neckCm: 45 },
        80,
      )
      expect(result).not.toBeNull()
      expect(result!.bodyFatPct).toBeGreaterThanOrEqual(3)
    })

    it('clamps body fat percent to at most 50%', () => {
      // Extreme wide waist vs neck pushes raw bf% above 50.
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 165, waistCm: 180, neckCm: 40 },
        150,
      )
      expect(result).not.toBeNull()
      expect(result!.bodyFatPct).toBeLessThanOrEqual(50)
      expect(result!.category).toBe('obese')
    })
  })

  describe('female inputs', () => {
    it('returns expected result for standard female measurements', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: 95 },
        62,
      )
      expect(result).not.toBeNull()
      expect(result!.bodyFatPct).toBeGreaterThan(18)
      expect(result!.bodyFatPct).toBeLessThan(30)
    })

    it('returns null when hip measurement is missing for female', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32 },
        62,
      )
      expect(result).toBeNull()
    })

    it('returns null when hip is implausibly small for female', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: 30 },
        62,
      )
      expect(result).toBeNull()
    })

    it('returns athletic category for lean female', () => {
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 170, waistCm: 65, neckCm: 30, hipCm: 90 },
        60,
      )
      expect(result).not.toBeNull()
      // Should be in athletic/fitness zone
      expect(['athletic', 'fitness']).toContain(result!.category)
    })
  })

  describe('lean mass and fat mass', () => {
    it('lean mass + fat mass equals total weight (male)', () => {
      const totalWeightKg = 80
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 90, neckCm: 38 },
        totalWeightKg,
      )
      expect(result).not.toBeNull()
      const sum = result!.leanMassKg + result!.fatMassKg
      expect(sum).toBeCloseTo(totalWeightKg, 0)
    })

    it('lean mass + fat mass equals total weight (female)', () => {
      const totalWeightKg = 62
      const result = calculateBodyFat(
        { sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: 95 },
        totalWeightKg,
      )
      expect(result).not.toBeNull()
      const sum = result!.leanMassKg + result!.fatMassKg
      expect(sum).toBeCloseTo(totalWeightKg, 0)
    })
  })

  describe('result rounding', () => {
    it('rounds body fat percent to one decimal place', () => {
      const result = calculateBodyFat(
        { sex: 'male', heightCm: 175, waistCm: 90, neckCm: 38 },
        78,
      )
      expect(result).not.toBeNull()
      // one decimal place means value * 10 is an integer
      expect(Math.round(result!.bodyFatPct * 10)).toBe(result!.bodyFatPct * 10)
    })
  })
})

describe('getBodyFatCategory', () => {
  describe('male boundaries', () => {
    it('classifies < 6% as essential', () => {
      expect(getBodyFatCategory('male', 5.9)).toBe('essential')
    })
    it('classifies 6% as athletic', () => {
      expect(getBodyFatCategory('male', 6)).toBe('athletic')
    })
    it('classifies 13.9% as athletic', () => {
      expect(getBodyFatCategory('male', 13.9)).toBe('athletic')
    })
    it('classifies 14% as fitness', () => {
      expect(getBodyFatCategory('male', 14)).toBe('fitness')
    })
    it('classifies 20.9% as fitness', () => {
      expect(getBodyFatCategory('male', 20.9)).toBe('fitness')
    })
    it('classifies 21% as average', () => {
      expect(getBodyFatCategory('male', 21)).toBe('average')
    })
    it('classifies 24.9% as average', () => {
      expect(getBodyFatCategory('male', 24.9)).toBe('average')
    })
    it('classifies 25% as obese', () => {
      expect(getBodyFatCategory('male', 25)).toBe('obese')
    })
  })

  describe('female boundaries', () => {
    it('classifies < 14% as essential', () => {
      expect(getBodyFatCategory('female', 13.9)).toBe('essential')
    })
    it('classifies 14% as athletic', () => {
      expect(getBodyFatCategory('female', 14)).toBe('athletic')
    })
    it('classifies 20.9% as athletic', () => {
      expect(getBodyFatCategory('female', 20.9)).toBe('athletic')
    })
    it('classifies 21% as fitness', () => {
      expect(getBodyFatCategory('female', 21)).toBe('fitness')
    })
    it('classifies 24.9% as fitness', () => {
      expect(getBodyFatCategory('female', 24.9)).toBe('fitness')
    })
    it('classifies 25% as average', () => {
      expect(getBodyFatCategory('female', 25)).toBe('average')
    })
    it('classifies 31.9% as average', () => {
      expect(getBodyFatCategory('female', 31.9)).toBe('average')
    })
    it('classifies 32% as obese', () => {
      expect(getBodyFatCategory('female', 32)).toBe('obese')
    })
  })
})

describe('BODY_FAT_CATEGORY_LABEL', () => {
  it('has a label for every category', () => {
    expect(BODY_FAT_CATEGORY_LABEL.essential).toBe('Essential fat')
    expect(BODY_FAT_CATEGORY_LABEL.athletic).toBe('Athletic')
    expect(BODY_FAT_CATEGORY_LABEL.fitness).toBe('Fitness')
    expect(BODY_FAT_CATEGORY_LABEL.average).toBe('Average')
    expect(BODY_FAT_CATEGORY_LABEL.obese).toBe('Above average')
  })
})
