import { describe, it, expect } from 'vitest'
import { deviation, heatLevel } from '../app/lib/deviation'
import { DEFAULT_RULE } from '../app/lib/wlt'

// 預設區間：L < -1、-1 ≤ T ≤ 2、2 < W
describe('deviation', () => {
  it('兩邊都沒填 → 0 / 0', () => {
    expect(deviation({ actual: [], ideal: [] }, DEFAULT_RULE)).toEqual({ miss: 0, over: 0 })
  })

  it('R 先換算成 WLT 再比：少賺看 W、多賠看 L，T 不計', () => {
    // 實際 1W 1L 1T；理想 3W 0L
    const d = deviation({ actual: [3, -2, 0.5], ideal: [3, 4, 2.5] }, DEFAULT_RULE)
    expect(d).toEqual({ miss: 2, over: 1 })
  })

  it('實際比理想好時不為負', () => {
    const d = deviation({ actual: [3, 3, 3], ideal: [3, -1.5, -1.5] }, DEFAULT_RULE)
    expect(d).toEqual({ miss: 0, over: 0 })
  })

  it('空手（實際 0 筆）時理想的 W 全額計入少賺', () => {
    expect(deviation({ actual: [], ideal: [3, 2.5, -2] }, DEFAULT_RULE)).toEqual({ miss: 2, over: 0 })
  })

  it('依區間規則換算', () => {
    const rule = { ...DEFAULT_RULE, hiTo: 'W' } as const // 剛好 2R 算 W
    expect(deviation({ actual: [], ideal: [2] }, DEFAULT_RULE).miss).toBe(0)
    expect(deviation({ actual: [], ideal: [2] }, rule).miss).toBe(1)
  })
})

describe('heatLevel', () => {
  it('0 為無、封頂 5', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(-3)).toBe(0)
    expect(heatLevel(3)).toBe(3)
    expect(heatLevel(9)).toBe(5)
  })
})
