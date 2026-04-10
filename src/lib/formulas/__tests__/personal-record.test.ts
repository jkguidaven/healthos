import {
  bestOneRepMax,
  estimateOneRepMax,
  getOverloadDeltaKg,
  getTopSet,
  isPersonalRecord,
} from '../personal-record'

describe('estimateOneRepMax', () => {
  it('returns Epley value for a normal weighted set', () => {
    // 100kg × 5 → 100 * (1 + 5/30) ≈ 116.667
    expect(estimateOneRepMax({ weightKg: 100, reps: 5 })).toBeCloseTo(
      116.667,
      2,
    )
  })

  it('ranks heavier-for-same-reps higher', () => {
    const lighter = estimateOneRepMax({ weightKg: 100, reps: 5 })!
    const heavier = estimateOneRepMax({ weightKg: 105, reps: 5 })!
    expect(heavier).toBeGreaterThan(lighter)
  })

  it('ranks more-reps-at-same-weight higher', () => {
    const fewer = estimateOneRepMax({ weightKg: 100, reps: 5 })!
    const more = estimateOneRepMax({ weightKg: 100, reps: 8 })!
    expect(more).toBeGreaterThan(fewer)
  })

  it('falls back to rep count for bodyweight sets', () => {
    expect(estimateOneRepMax({ weightKg: null, reps: 12 })).toBe(12)
  })

  it('returns null when reps is missing or zero', () => {
    expect(estimateOneRepMax({ weightKg: 100, reps: null })).toBeNull()
    expect(estimateOneRepMax({ weightKg: 100, reps: 0 })).toBeNull()
  })

  it('returns null for negative weight', () => {
    expect(estimateOneRepMax({ weightKg: -10, reps: 5 })).toBeNull()
  })
})

describe('bestOneRepMax', () => {
  it('returns the highest e1RM across sets', () => {
    const best = bestOneRepMax([
      { weightKg: 80, reps: 8 }, // 101.33
      { weightKg: 100, reps: 5 }, // 116.67
      { weightKg: 90, reps: 6 }, // 108
    ])
    expect(best).toBeCloseTo(116.667, 2)
  })

  it('returns null when no set produces an e1RM', () => {
    expect(
      bestOneRepMax([
        { weightKg: 100, reps: null },
        { weightKg: 100, reps: 0 },
      ]),
    ).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(bestOneRepMax([])).toBeNull()
  })
})

describe('isPersonalRecord', () => {
  it('flags a heavier same-rep set as a PR', () => {
    expect(
      isPersonalRecord(
        { weightKg: 105, reps: 5 },
        [{ weightKg: 100, reps: 5 }],
      ),
    ).toBe(true)
  })

  it('flags an extra-rep set at the same weight as a PR', () => {
    expect(
      isPersonalRecord(
        { weightKg: 100, reps: 6 },
        [{ weightKg: 100, reps: 5 }],
      ),
    ).toBe(true)
  })

  it('does not flag a lighter set as a PR', () => {
    expect(
      isPersonalRecord(
        { weightKg: 95, reps: 5 },
        [{ weightKg: 100, reps: 5 }],
      ),
    ).toBe(false)
  })

  it('does not flag the very first time the exercise is performed', () => {
    expect(isPersonalRecord({ weightKg: 100, reps: 5 }, [])).toBe(false)
  })

  it('does not flag an exact tie as a PR', () => {
    expect(
      isPersonalRecord(
        { weightKg: 100, reps: 5 },
        [{ weightKg: 100, reps: 5 }],
      ),
    ).toBe(false)
  })

  it('handles bodyweight rep PRs', () => {
    expect(
      isPersonalRecord(
        { weightKg: null, reps: 13 },
        [{ weightKg: null, reps: 12 }],
      ),
    ).toBe(true)
  })
})

describe('getOverloadDeltaKg', () => {
  it('returns positive delta when current beats previous', () => {
    const delta = getOverloadDeltaKg(
      [{ weightKg: 105, reps: 5 }],
      [{ weightKg: 100, reps: 5 }],
    )
    // 105 * (1+5/30) - 100 * (1+5/30) = 5.83 → 5.8
    expect(delta).toBe(5.8)
  })

  it('returns negative delta when current is lighter', () => {
    const delta = getOverloadDeltaKg(
      [{ weightKg: 95, reps: 5 }],
      [{ weightKg: 100, reps: 5 }],
    )
    expect(delta).toBeLessThan(0)
  })

  it('returns null when previous data is missing', () => {
    expect(getOverloadDeltaKg([{ weightKg: 100, reps: 5 }], [])).toBeNull()
  })

  it('returns null when current data is missing', () => {
    expect(getOverloadDeltaKg([], [{ weightKg: 100, reps: 5 }])).toBeNull()
  })
})

describe('getTopSet', () => {
  it('returns the set with the highest e1RM', () => {
    const sets = [
      { weightKg: 80, reps: 8 },
      { weightKg: 100, reps: 5 },
      { weightKg: 90, reps: 6 },
    ]
    expect(getTopSet(sets)).toEqual({ weightKg: 100, reps: 5 })
  })

  it('returns null for empty input', () => {
    expect(getTopSet([])).toBeNull()
  })
})
