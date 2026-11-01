import { describe, it, expect } from 'vitest'
import { fmtR, sumR } from '../app/lib/rValue'

describe('sumR / fmtR', () => {
  it('加總到兩位小數、正數帶 +', () => {
    expect(sumR([0.1, 0.2])).toBe(0.3)
    expect(fmtR(2.5)).toBe('+2.5')
    expect(fmtR(-1)).toBe('-1')
    expect(fmtR(0)).toBe('0')
  })
})
