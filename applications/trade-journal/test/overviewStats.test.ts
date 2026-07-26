import { describe, it, expect } from 'vitest'
import { summarize } from '../app/lib/overviewStats'
import type { EntryWithPresence, ImagePresence, Wlt } from '../shared/domain'

const NONE: ImagePresence = { trade: false, raw: false, review: false }
const ALL: ImagePresence = { trade: true, raw: true, review: true }

function mk(
  date: string,
  opts: Partial<EntryWithPresence> & { images?: ImagePresence } = {},
): EntryWithPresence {
  return {
    id: date,
    marketId: 'm',
    tradeDate: date,
    actual: null,
    ideal: null,
    would: null,
    noTrade: false,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
    images: NONE,
    ...opts,
  }
}
const wlt = (w: number, l: number): Wlt => ({ w, l, t: 0 })

describe('summarize', () => {
  it('狀態分類：已復盤 / 待復盤 / 有紀錄分母正確', () => {
    const entries = [
      mk('2026-07-01', { actual: wlt(2, 1), ideal: wlt(3, 0), images: ALL }), // reviewed
      mk('2026-07-02', { actual: wlt(1, 2), images: { trade: true, raw: false, review: false } }), // recorded → 待復盤
      mk('2026-07-03', { noTrade: true }), // notrade → 待復盤
      mk('2026-07-06', { noTrade: true, ideal: wlt(0, 0), images: { trade: false, raw: true, review: true } }), // notrade_reviewed
      mk('2026-07-07'), // empty，不計
    ]
    const { stats } = summarize(entries)
    expect(stats.recordedDays).toBe(4) // 排除 empty
    expect(stats.reviewedDays).toBe(2) // reviewed + notrade_reviewed
    expect(stats.todoDays).toBe(2) // recorded + notrade
  })

  it('少賺/多賠加總、勝率、清單排序', () => {
    const entries = [
      // 少賺 4-2-0=2、多賠 1-0=1
      mk('2026-07-01', { actual: wlt(2, 1), ideal: wlt(4, 0), images: ALL }),
      // 少賺 5-1-1=3、多賠 2-0=2
      mk('2026-07-02', { actual: wlt(1, 2), ideal: wlt(5, 0), would: wlt(1, 0), images: ALL }),
    ]
    const { stats, heat } = summarize(entries)
    expect(stats.missSum).toBe(5)
    expect(stats.overSum).toBe(3)
    // 實際勝率 = (2+1)/((2+1)+(1+2)) = 3/6 = 0.5
    expect(stats.actualWinRate).toBeCloseTo(0.5)
    // 理想勝率 = (4+5)/((4+5)+(0+0)) = 1
    expect(stats.idealWinRate).toBe(1)
    // 高偏差排序：7/02（少3）在 7/01（少2）之前
    expect(heat.map((h) => h.date)).toEqual(['2026-07-02', '2026-07-01'])
  })

  it('無偏差的日子不進高偏差清單；勝率無資料為 null', () => {
    const entries = [mk('2026-07-03', { noTrade: true })]
    const { heat, stats } = summarize(entries)
    expect(heat).toHaveLength(0)
    expect(stats.actualWinRate).toBeNull()
    expect(stats.idealWinRate).toBeNull()
  })

  it('待復盤清單依日期排序並標記空手', () => {
    const entries = [
      mk('2026-07-08', { noTrade: true }),
      mk('2026-07-02', { actual: wlt(1, 1), images: { trade: true, raw: false, review: false } }),
    ]
    const { todo } = summarize(entries)
    expect(todo.map((t) => t.date)).toEqual(['2026-07-02', '2026-07-08'])
    expect(todo.find((t) => t.date === '2026-07-08')?.notrade).toBe(true)
    expect(todo.find((t) => t.date === '2026-07-02')?.notrade).toBe(false)
  })
})
