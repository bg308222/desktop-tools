import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'
import { createMarketRepo } from '../electron/db/repositories/marketRepo'
import { createEntryRepo } from '../electron/db/repositories/entryRepo'

async function setup() {
  const db = await openDb(':memory:')
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const m = markets.create('台指期')
  return { db, markets, entries, marketId: m.id }
}

describe('entryRepo', () => {
  it('upsert 同 (market,date) 不重複，會更新', async () => {
    const { entries, marketId } = await setup()
    const a = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: { w: 2, l: 1, t: 0 } })
    const b = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: { w: 3, l: 0, t: 1 } })
    expect(a.id).toBe(b.id)
    expect(b.actual).toEqual({ w: 3, l: 0, t: 1 })
    expect(entries.listInRange('2026-07-01', '2026-07-31')).toHaveLength(1)
  })

  it('部分 upsert 不覆蓋未提供的欄位', async () => {
    const { entries, marketId } = await setup()
    entries.upsert({ marketId, tradeDate: '2026-07-14', actual: { w: 1, l: 0, t: 0 }, noteJson: '{"a":1}' })
    // 只更新 ideal，note 與 actual 應保留
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14', ideal: { w: 2, l: 0, t: 0 } })
    expect(e.actual).toEqual({ w: 1, l: 0, t: 0 })
    expect(e.ideal).toEqual({ w: 2, l: 0, t: 0 })
    expect(e.noteJson).toBe('{"a":1}')
  })

  it('setWlt 可清空為 null', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: { w: 1, l: 1, t: 1 } })
    entries.setWlt(e.id, 'actual', null)
    expect(entries.getById(e.id)?.actual).toBeNull()
  })

  it('listByMarketInRange 依日期排序', async () => {
    const { entries, marketId } = await setup()
    entries.upsert({ marketId, tradeDate: '2026-07-16' })
    entries.upsert({ marketId, tradeDate: '2026-07-14' })
    entries.upsert({ marketId, tradeDate: '2026-07-15' })
    const dates = entries.listByMarketInRange(marketId, '2026-07-13', '2026-07-17').map((e) => e.tradeDate)
    expect(dates).toEqual(['2026-07-14', '2026-07-15', '2026-07-16'])
  })
})
