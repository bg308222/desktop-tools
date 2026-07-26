import { describe, it, expect } from 'vitest'
import { deviation, compareDeviation, heatLevel } from '../app/lib/deviation'

describe('deviation', () => {
  it('actual 或 ideal 缺 → null', () => {
    expect(deviation({ actual: null, ideal: { w: 3, l: 0, t: 0 }, would: null })).toBeNull()
    expect(deviation({ actual: { w: 1, l: 0, t: 0 }, ideal: null, would: null })).toBeNull()
  })

  it('少賺 = max(0, 理想W − 實際W − 會做W)，會做扣掉', () => {
    // 理想 4W0L、實際 2W1L、會做 1W0L → 少賺 = 4-2-1 = 1、多賠 = 1-0 = 1
    const d = deviation({
      actual: { w: 2, l: 1, t: 0 },
      ideal: { w: 4, l: 0, t: 0 },
      would: { w: 1, l: 0, t: 0 },
    })
    expect(d).toEqual({ miss: 1, over: 1 })
  })

  it('會做為 null 視為 0', () => {
    const d = deviation({ actual: { w: 2, l: 0, t: 0 }, ideal: { w: 4, l: 0, t: 0 }, would: null })
    expect(d).toEqual({ miss: 2, over: 0 })
  })

  it('做得比理想好時夾在 0（不為負）', () => {
    const d = deviation({
      actual: { w: 5, l: 0, t: 0 },
      ideal: { w: 3, l: 2, t: 0 },
      would: null,
    })
    expect(d).toEqual({ miss: 0, over: 0 })
  })

  it('compareDeviation 字典序：先比少賺，平手比多賠', () => {
    expect(compareDeviation({ miss: 3, over: 0 }, { miss: 2, over: 9 })).toBeLessThan(0)
    expect(compareDeviation({ miss: 2, over: 1 }, { miss: 2, over: 3 })).toBeGreaterThan(0)
    expect(compareDeviation({ miss: 2, over: 2 }, { miss: 2, over: 2 })).toBe(0)
  })

  it('heatLevel：0 為無、封頂 5', () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(-3)).toBe(0)
    expect(heatLevel(3)).toBe(3)
    expect(heatLevel(9)).toBe(5)
  })
})
