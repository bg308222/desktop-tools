import { describe, it, expect } from 'vitest'
import { countInScope, inMarkets, sanitizeMarketIds } from '../app/lib/queryScope'

describe('queryScope', () => {
  it('市場範圍：空陣列＝全部', () => {
    expect(inMarkets('m1', [])).toBe(true)
    expect(inMarkets('m1', ['m2', 'm1'])).toBe(true)
    expect(inMarkets('m1', ['m2'])).toBe(false)
  })

  it('同時套時間與市場；重複日期各算一筆', () => {
    const ms = [
      { tradeDate: '2026-10-01', marketId: 'm1' },
      { tradeDate: '2026-10-01', marketId: 'm2' },
      { tradeDate: '2026-10-05', marketId: 'm1' },
      { tradeDate: '2026-10-09', marketId: 'm1' },
    ]
    const r = { from: '2026-10-01', to: '2026-10-05' }
    expect(countInScope(ms, r, [])).toBe(3)
    expect(countInScope(ms, r, ['m1'])).toBe(2)
    expect(countInScope(ms, { from: null, to: null }, ['m2'])).toBe(1)
  })

  it('sanitizeMarketIds：只留字串、去重', () => {
    expect(sanitizeMarketIds(['a', 'a', 3, null])).toEqual(['a'])
    expect(sanitizeMarketIds('x')).toEqual([])
  })
})
