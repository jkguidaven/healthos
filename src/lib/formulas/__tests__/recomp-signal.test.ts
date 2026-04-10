import { getRecompSignal } from '../recomp-signal'

describe('getRecompSignal', () => {
  it('returns recomp_working when weight up and waist down', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.6,
      waistDeltaCm: -0.4,
      armDeltaCm: 0.2,
    })
    expect(result.signal).toBe('recomp_working')
    expect(result.message).toBe('Scale up but waist down — recomp is working')
  })

  it('returns lean_mass_building when weight down and arm up', () => {
    const result = getRecompSignal({
      weightDeltaKg: -0.5,
      waistDeltaCm: null,
      armDeltaCm: 0.3,
    })
    expect(result.signal).toBe('lean_mass_building')
    expect(result.message).toBe('Scale down, arm up — lean mass building')
  })

  it('returns plateau when weight change is less than 0.3 kg', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.1,
      waistDeltaCm: null,
      armDeltaCm: null,
    })
    expect(result.signal).toBe('plateau')
    expect(result.message).toBe(
      'Weight stable — typical recomp plateau, check measurements',
    )
  })

  it('returns plateau for small negative weight delta', () => {
    const result = getRecompSignal({
      weightDeltaKg: -0.2,
      waistDeltaCm: null,
      armDeltaCm: null,
    })
    expect(result.signal).toBe('plateau')
  })

  it('returns cut_progress when weight down and waist down', () => {
    const result = getRecompSignal({
      weightDeltaKg: -0.8,
      waistDeltaCm: -0.5,
      armDeltaCm: null,
    })
    expect(result.signal).toBe('cut_progress')
    expect(result.message).toBe(
      'Both weight and waist down — fat loss progressing',
    )
  })

  it('returns cut_progress even if arm is flat or not measured', () => {
    const result = getRecompSignal({
      weightDeltaKg: -1.0,
      waistDeltaCm: -0.7,
      armDeltaCm: 0,
    })
    expect(result.signal).toBe('cut_progress')
  })

  it('returns bulk_progress when weight up, arm up, waist holding', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.8,
      waistDeltaCm: 0.3,
      armDeltaCm: 0.2,
    })
    expect(result.signal).toBe('bulk_progress')
    expect(result.message).toBe(
      'Weight and arm up, waist holding — clean bulk',
    )
  })

  it('returns bulk_progress when waist moves within -0.5cm to +0.5cm', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.6,
      waistDeltaCm: -0.5,
      armDeltaCm: 0.1,
    })
    // weight up + waist down → classified as recomp_working (higher priority)
    expect(result.signal).toBe('recomp_working')
  })

  it('returns bulk_progress for small positive waist change with arm up', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.7,
      waistDeltaCm: 0.5,
      armDeltaCm: 0.3,
    })
    expect(result.signal).toBe('bulk_progress')
  })

  it('returns unclear when waist exceeds bulk hold threshold', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.7,
      waistDeltaCm: 0.8,
      armDeltaCm: 0.3,
    })
    expect(result.signal).toBe('unclear')
  })

  it('returns unclear when only weight is up and nothing else measured', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.7,
      waistDeltaCm: null,
      armDeltaCm: null,
    })
    expect(result.signal).toBe('unclear')
    expect(result.message).toBe(
      'Not enough signal yet — log more data points',
    )
  })

  it('returns unclear when weight down and no arm/waist measurements', () => {
    const result = getRecompSignal({
      weightDeltaKg: -0.7,
      waistDeltaCm: null,
      armDeltaCm: null,
    })
    expect(result.signal).toBe('unclear')
  })

  it('returns unclear when weight down, waist up, arm flat', () => {
    const result = getRecompSignal({
      weightDeltaKg: -0.7,
      waistDeltaCm: 0.3,
      armDeltaCm: 0,
    })
    expect(result.signal).toBe('unclear')
  })

  it('does not misclassify weight-stable input as recomp_working', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.05,
      waistDeltaCm: -0.5,
      armDeltaCm: 0.1,
    })
    // weight delta is positive but below plateau threshold and
    // recomp_working fires first because delta > 0 and waist < 0.
    expect(result.signal).toBe('recomp_working')
  })

  it('exactly 0.3kg weight delta is not considered plateau', () => {
    const result = getRecompSignal({
      weightDeltaKg: 0.3,
      waistDeltaCm: null,
      armDeltaCm: null,
    })
    // 0.3 is NOT strictly less than 0.3, so it falls through to unclear.
    expect(result.signal).toBe('unclear')
  })
})
