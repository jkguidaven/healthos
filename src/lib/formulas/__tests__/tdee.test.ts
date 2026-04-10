import { ACTIVITY_MULTIPLIERS } from '../constants'
import { calculateBMR, calculateTDEE } from '../tdee'

describe('calculateBMR', () => {
  describe('male', () => {
    it('matches Mifflin-St Jeor for 30yo 80kg 180cm male', () => {
      // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
      expect(
        calculateBMR({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }),
      ).toBe(1780)
    })

    it('matches Mifflin-St Jeor for 25yo 75kg 175cm male', () => {
      // 750 + 1093.75 - 125 + 5 = 1723.75 → 1724
      expect(
        calculateBMR({ sex: 'male', weightKg: 75, heightCm: 175, age: 25 }),
      ).toBe(1724)
    })

    it('matches Mifflin-St Jeor for 45yo 90kg 185cm male', () => {
      // 900 + 1156.25 - 225 + 5 = 1836.25 → 1836
      expect(
        calculateBMR({ sex: 'male', weightKg: 90, heightCm: 185, age: 45 }),
      ).toBe(1836)
    })
  })

  describe('female', () => {
    it('matches Mifflin-St Jeor for 30yo 65kg 165cm female', () => {
      // 650 + 1031.25 - 150 - 161 = 1370.25 → 1370
      expect(
        calculateBMR({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 }),
      ).toBe(1370)
    })

    it('matches Mifflin-St Jeor for 25yo 60kg 160cm female', () => {
      // 600 + 1000 - 125 - 161 = 1314 → 1314
      expect(
        calculateBMR({ sex: 'female', weightKg: 60, heightCm: 160, age: 25 }),
      ).toBe(1314)
    })

    it('matches Mifflin-St Jeor for 40yo 70kg 170cm female', () => {
      // 700 + 1062.5 - 200 - 161 = 1401.5 → 1402
      expect(
        calculateBMR({ sex: 'female', weightKg: 70, heightCm: 170, age: 40 }),
      ).toBe(1402)
    })
  })

  it('female BMR is 166 lower than male BMR for same body', () => {
    const male = calculateBMR({
      sex: 'male',
      weightKg: 70,
      heightCm: 170,
      age: 30,
    })
    const female = calculateBMR({
      sex: 'female',
      weightKg: 70,
      heightCm: 170,
      age: 30,
    })
    // male has +5, female has -161 → delta = 166
    expect(male - female).toBe(166)
  })

  it('returns an integer (rounds result)', () => {
    const bmr = calculateBMR({
      sex: 'male',
      weightKg: 72.3,
      heightCm: 178.4,
      age: 29,
    })
    expect(Number.isInteger(bmr)).toBe(true)
  })
})

describe('calculateTDEE', () => {
  const BMR = 1780

  it('applies sedentary multiplier (1.2)', () => {
    expect(calculateTDEE(BMR, 'sedentary')).toBe(Math.round(1780 * 1.2))
  })

  it('applies light multiplier (1.375)', () => {
    expect(calculateTDEE(BMR, 'light')).toBe(Math.round(1780 * 1.375))
  })

  it('applies moderate multiplier (1.55)', () => {
    expect(calculateTDEE(BMR, 'moderate')).toBe(Math.round(1780 * 1.55))
  })

  it('applies active multiplier (1.725)', () => {
    expect(calculateTDEE(BMR, 'active')).toBe(Math.round(1780 * 1.725))
  })

  it('applies very_active multiplier (1.9)', () => {
    expect(calculateTDEE(BMR, 'very_active')).toBe(Math.round(1780 * 1.9))
  })

  it('TDEE equals BMR * multiplier (rounded) for every activity level', () => {
    const levels: (keyof typeof ACTIVITY_MULTIPLIERS)[] = [
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ]
    for (const level of levels) {
      expect(calculateTDEE(BMR, level)).toBe(
        Math.round(BMR * ACTIVITY_MULTIPLIERS[level]),
      )
    }
  })

  it('returns an integer', () => {
    expect(Number.isInteger(calculateTDEE(1723, 'light'))).toBe(true)
  })

  it('sedentary TDEE is lowest and very_active is highest', () => {
    const sed = calculateTDEE(BMR, 'sedentary')
    const light = calculateTDEE(BMR, 'light')
    const mod = calculateTDEE(BMR, 'moderate')
    const act = calculateTDEE(BMR, 'active')
    const va = calculateTDEE(BMR, 'very_active')
    expect(sed).toBeLessThan(light)
    expect(light).toBeLessThan(mod)
    expect(mod).toBeLessThan(act)
    expect(act).toBeLessThan(va)
  })
})
