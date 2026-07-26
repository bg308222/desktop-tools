import { describe, it, expect } from 'vitest'
import { openDb } from '../server/db/connection'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createImageRepo } from '../server/db/repositories/imageRepo'

async function setup() {
  const db = await openDb(':memory:')
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const images = createImageRepo(db)
  const m = markets.create('台指期')
  return { db, markets, entries, images, marketId: m.id }
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

  it('setWlt would 與 setNoTrade、映射正確', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
    entries.setWlt(e.id, 'would', { w: 1, l: 0, t: 0 })
    entries.setNoTrade(e.id, true)
    const got = entries.getById(e.id)!
    expect(got.would).toEqual({ w: 1, l: 0, t: 0 })
    expect(got.noTrade).toBe(true)
  })

  it('upsert 可帶 noTrade 與 would', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({
      marketId,
      tradeDate: '2026-07-15',
      noTrade: true,
      would: { w: 2, l: 0, t: 0 },
    })
    expect(e.noTrade).toBe(true)
    expect(e.would).toEqual({ w: 2, l: 0, t: 0 })
  })

  it('listPresenceByMarketInRange：圖片存在旗標、範圍與市場過濾', async () => {
    const { entries, images, markets, marketId } = await setup()
    const other = markets.create('小道瓊')
    const e1 = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: { w: 1, l: 0, t: 0 } })
    images.upsert(e1.id, 'trade', 'a.png', null, null)
    images.upsert(e1.id, 'review', 'b.png', null, null)
    entries.upsert({ marketId, tradeDate: '2026-07-15' }) // 無圖
    entries.upsert({ marketId, tradeDate: '2026-08-01' }) // 超出範圍
    entries.upsert({ marketId: other.id, tradeDate: '2026-07-14' }) // 別的市場

    const rows = entries.listPresenceByMarketInRange(marketId, '2026-07-01', '2026-07-31')
    expect(rows.map((r) => r.tradeDate)).toEqual(['2026-07-14', '2026-07-15'])
    expect(rows[0]!.images).toEqual({ trade: true, raw: false, review: true })
    expect(rows[1]!.images).toEqual({ trade: false, raw: false, review: false })
  })
})
