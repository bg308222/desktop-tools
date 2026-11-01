import { describe, it, expect } from 'vitest'
import { emptyTrade, isBlankTrade, sanitizeTrade, sanitizeTrades } from '../shared/trades'

describe('sanitizeTrade', () => {
  it('兩位小數；非數字 → null', () => {
    expect(sanitizeTrade({ initialTarget: 2.345, paStop: 'x', realized: NaN, mfe: Infinity })).toEqual({
      ...emptyTrade(),
      initialTarget: 2.35,
    })
  })

  it('值域：初始止盈 > 0；PA 止損、PA 止盈、MFE ≥ 0；實際損益不限', () => {
    expect(sanitizeTrade({ initialTarget: 0 }).initialTarget).toBeNull()
    expect(sanitizeTrade({ initialTarget: 0.01 }).initialTarget).toBe(0.01)
    expect(sanitizeTrade({ paStop: 0, paTarget: 0, mfe: 0 })).toMatchObject({ paStop: 0, paTarget: 0, mfe: 0 })
    expect(sanitizeTrade({ paStop: -0.5, paTarget: -1, mfe: -2 })).toMatchObject({
      paStop: null,
      paTarget: null,
      mfe: null,
    })
    expect(sanitizeTrade({ realized: -1.5 }).realized).toBe(-1.5)
    expect(sanitizeTrade({ realized: 0 }).realized).toBe(0)
  })

  it('不認得的輸入 → 全空', () => {
    expect(sanitizeTrade(null)).toEqual(emptyTrade())
    expect(isBlankTrade(sanitizeTrade('x'))).toBe(true)
  })
})

describe('sanitizeTrades', () => {
  it('非陣列 → []；全空列丟掉、順序保留', () => {
    expect(sanitizeTrades(null)).toEqual([])
    const out = sanitizeTrades([{ initialTarget: 3 }, {}, { realized: -1 }])
    expect(out.map((t) => [t.initialTarget, t.realized])).toEqual([
      [3, null],
      [null, -1],
    ])
  })
})
