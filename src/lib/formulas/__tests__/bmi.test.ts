import {
  BMI_CATEGORY_LABEL,
  calculateBMI,
  getBMICategory,
  type BMICategory,
} from '../bmi'

describe('calculateBMI', () => {
  it('computes BMI for a typical male', () => {
    const result = calculateBMI(180, 80)
    expect(result).not.toBeNull()
    expect(result!.bmi).toBeCloseTo(24.7, 1)
    expect(result!.category).toBe('normal')
  })

  it('computes BMI for a typical female', () => {
    const result = calculateBMI(165, 60)
    expect(result).not.toBeNull()
    expect(result!.bmi).toBeCloseTo(22.0, 1)
    expect(result!.category).toBe('normal')
  })

  it('rounds to one decimal place', () => {
    const result = calculateBMI(170, 70)
    expect(result).not.toBeNull()
    // 70 / 1.7^2 = 24.221... → 24.2
    expect(result!.bmi).toBe(24.2)
  })

  it('returns null for implausibly low height', () => {
    expect(calculateBMI(50, 70)).toBeNull()
  })

  it('returns null for implausibly high height', () => {
    expect(calculateBMI(300, 70)).toBeNull()
  })

  it('returns null for implausibly low weight', () => {
    expect(calculateBMI(170, 10)).toBeNull()
  })

  it('returns null for implausibly high weight', () => {
    expect(calculateBMI(170, 500)).toBeNull()
  })

  it('returns null for NaN inputs', () => {
    expect(calculateBMI(Number.NaN, 70)).toBeNull()
    expect(calculateBMI(170, Number.NaN)).toBeNull()
  })

  it('handles boundary at the lower edge of healthy', () => {
    // 18.5 = weight / 1.7^2 → weight = 53.465
    const result = calculateBMI(170, 53.5)
    expect(result).not.toBeNull()
    expect(result!.category).toBe('normal')
  })

  it('classifies underweight', () => {
    const result = calculateBMI(170, 50)
    expect(result).not.toBeNull()
    expect(result!.category).toBe('underweight')
  })

  it('classifies overweight', () => {
    const result = calculateBMI(170, 80)
    expect(result).not.toBeNull()
    expect(result!.category).toBe('overweight')
  })

  it('classifies obese class 1', () => {
    const result = calculateBMI(170, 90)
    expect(result).not.toBeNull()
    expect(result!.category).toBe('obese_class_1')
  })
})

describe('getBMICategory', () => {
  const cases: readonly { bmi: number; expected: BMICategory }[] = [
    { bmi: 17, expected: 'underweight' },
    { bmi: 18.4, expected: 'underweight' },
    { bmi: 18.5, expected: 'normal' },
    { bmi: 22, expected: 'normal' },
    { bmi: 24.9, expected: 'normal' },
    { bmi: 25, expected: 'overweight' },
    { bmi: 29.9, expected: 'overweight' },
    { bmi: 30, expected: 'obese_class_1' },
    { bmi: 34.9, expected: 'obese_class_1' },
    { bmi: 35, expected: 'obese_class_2' },
    { bmi: 39.9, expected: 'obese_class_2' },
    { bmi: 40, expected: 'obese_class_3' },
    { bmi: 50, expected: 'obese_class_3' },
  ]

  for (const { bmi, expected } of cases) {
    it(`maps ${bmi} → ${expected}`, () => {
      expect(getBMICategory(bmi)).toBe(expected)
    })
  }
})

describe('BMI_CATEGORY_LABEL', () => {
  it('has a label for every category', () => {
    const categories: BMICategory[] = [
      'underweight',
      'normal',
      'overweight',
      'obese_class_1',
      'obese_class_2',
      'obese_class_3',
    ]
    for (const cat of categories) {
      expect(BMI_CATEGORY_LABEL[cat]).toBeTruthy()
      expect(typeof BMI_CATEGORY_LABEL[cat]).toBe('string')
    }
  })
})
