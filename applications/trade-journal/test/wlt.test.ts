import { describe, it, expect } from 'vitest'
import { DEFAULT_RULE, classify, describeRule, fmtR, sanitizeRule, sumR, tally } from '../app/lib/wlt'

describe('classify', () => {
  it('預設：L < -1、-1 ≤ T ≤ 2、2 < W', () => {
    expect(classify(-1.5, DEFAULT_RULE)).toBe('L')
    expect(classify(-1, DEFAULT_RULE)).toBe('T')
    expect(classify(0, DEFAULT_RULE)).toBe('T')
    expect(classify(2, DEFAULT_RULE)).toBe('T')
    expect(classify(2.01, DEFAULT_RULE)).toBe('W')
  })

  it('邊界值歸到 L／W 側', () => {
    const rule = { lo: -1, loTo: 'L', hi: 2, hiTo: 'W' } as const
    expect(classify(-1, rule)).toBe('L')
    expect(classify(2, rule)).toBe('W')
    expect(classify(1.99, rule)).toBe('T')
  })

  it('lo = hi 時 T 只剩那一點（或沒有）', () => {
    expect(classify(0, { lo: 0, loTo: 'T', hi: 0, hiTo: 'T' })).toBe('T')
    expect(classify(0, { lo: 0, loTo: 'L', hi: 0, hiTo: 'T' })).toBe('L')
  })
})

describe('tally / sumR / fmtR', () => {
  it('計數與加總', () => {
    expect(tally([2.5, -1, 0.5, -2], DEFAULT_RULE)).toEqual({ w: 1, l: 1, t: 2 })
    expect(tally([], DEFAULT_RULE)).toEqual({ w: 0, l: 0, t: 0 })
    expect(sumR([0.1, 0.2])).toBe(0.3)
    expect(fmtR(2.5)).toBe('+2.5')
    expect(fmtR(-1)).toBe('-1')
    expect(fmtR(0)).toBe('0')
  })
})

describe('sanitizeRule / describeRule', () => {
  it('不合法用預設、lo > hi 對調', () => {
    expect(sanitizeRule(null)).toEqual(DEFAULT_RULE)
    expect(sanitizeRule({ lo: 3, hi: -2, loTo: 'L', hiTo: 'x' })).toEqual({
      lo: -2,
      loTo: 'L',
      hi: 3,
      hiTo: 'T',
    })
  })

  it('區間文字', () => {
    expect(describeRule(DEFAULT_RULE)).toEqual({ L: 'L < -1', T: '-1 ≤ T ≤ 2', W: '2 < W' })
    expect(describeRule({ lo: -1, loTo: 'L', hi: 2, hiTo: 'W' })).toEqual({
      L: 'L ≤ -1',
      T: '-1 < T < 2',
      W: '2 ≤ W',
    })
  })
})
