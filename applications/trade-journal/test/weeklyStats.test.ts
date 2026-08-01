import { describe, it, expect } from 'vitest'
import { weeklyStats } from '../app/lib/weeklyStats'
import type { Entry, Market, Wlt } from '../shared/domain'

function entry(tradeDate: string, marketId: string, partial: Partial<Entry> = {}): Entry {
  return {
    id: `${marketId}-${tradeDate}`,
    marketId,
    tradeDate,
    actual: null,
    ideal: null,
    would: null,
    noTrade: false,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const market = (id: string, name: string, sortOrder: number): Market => ({
  id,
  name,
  sortOrder,
  archived: false,
})

const MARKETS = [market('m1', '台指', 0), market('m2', '小那', 1)]
const w = (win: number, l: number, t: number): Wlt => ({ w: win, l, t })
const ZERO = { w: 0, l: 0, t: 0 }

describe('weeklyStats', () => {
  it('沒有資料 → 空陣列', () => {
    expect(weeklyStats([], MARKETS, '2026-07-29')).toEqual([])
  })

  it('週一到週日歸為同一週，start/end 為該週週一與週日', () => {
    const es = [
      entry('2026-07-27', 'm1', { actual: w(1, 0, 0) }), // 週一
      entry('2026-08-02', 'm1', { actual: w(2, 0, 0) }), // 週日
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r).toHaveLength(1)
    expect(r[0]!.start).toBe('2026-07-27')
    expect(r[0]!.end).toBe('2026-08-02')
    expect(r[0]!.actual).toEqual(w(3, 0, 0))
  })

  it('跨週的資料分成兩組，由新到舊排列', () => {
    const es = [
      entry('2026-07-20', 'm1', { actual: w(1, 0, 0) }),
      entry('2026-07-27', 'm1', { actual: w(5, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r.map((x) => x.start)).toEqual(['2026-07-27', '2026-07-20'])
  })

  it('三組 WLT 各自獨立加總，null 跳過', () => {
    const es = [
      entry('2026-07-27', 'm1', { actual: w(1, 2, 3), ideal: w(4, 0, 0) }),
      entry('2026-07-28', 'm1', { actual: w(10, 20, 30), would: w(0, 0, 7) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.actual).toEqual(w(11, 22, 33))
    expect(r[0]!.ideal).toEqual(w(4, 0, 0))
    expect(r[0]!.would).toEqual(w(0, 0, 7))
  })

  it('完全沒有 WLT 的 entry 不算資料，該週不出現', () => {
    const es = [entry('2026-07-27', 'm1', { noTrade: true })]
    expect(weeklyStats(es, MARKETS, '2026-07-29')).toEqual([])
  })

  it('市場明細依 sortOrder 排序，無資料的市場不出現', () => {
    const es = [
      entry('2026-07-27', 'm2', { actual: w(3, 0, 0) }),
      entry('2026-07-28', 'm1', { actual: w(1, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.markets.map((m) => m.name)).toEqual(['台指', '小那'])
    expect(r[0]!.markets[0]!.actual).toEqual(w(1, 0, 0))
    expect(r[0]!.markets[1]!.actual).toEqual(w(3, 0, 0))
  })

  it('市場無某一組 WLT 時該組為 0', () => {
    const es = [entry('2026-07-27', 'm1', { actual: w(1, 0, 0) })]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.markets[0]!.ideal).toEqual(ZERO)
    expect(r[0]!.markets[0]!.would).toEqual(ZERO)
  })

  it('isCurrent 只有含今天的那週為 true', () => {
    const es = [
      entry('2026-07-20', 'm1', { actual: w(1, 0, 0) }),
      entry('2026-07-27', 'm1', { actual: w(1, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r[0]!.isCurrent).toBe(true)
    expect(r[1]!.isCurrent).toBe(false)
  })

  it('跨年：12/28(週一) 與 1/3(週日) 同一週', () => {
    const es = [
      entry('2026-12-28', 'm1', { actual: w(1, 0, 0) }),
      entry('2027-01-03', 'm1', { actual: w(1, 0, 0) }),
    ]
    const r = weeklyStats(es, MARKETS, '2026-07-29')
    expect(r).toHaveLength(1)
    expect(r[0]!.start).toBe('2026-12-28')
    expect(r[0]!.end).toBe('2027-01-03')
  })

  it('marketId 找不到對應市場時略過該筆', () => {
    const es = [entry('2026-07-27', 'ghost', { actual: w(9, 9, 9) })]
    expect(weeklyStats(es, MARKETS, '2026-07-29')).toEqual([])
  })
})
