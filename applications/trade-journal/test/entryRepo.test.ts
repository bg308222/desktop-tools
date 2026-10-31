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
    const a = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [2, -1] })
    const b = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [3] })
    expect(a.id).toBe(b.id)
    expect(b.actual).toEqual([3])
    expect(entries.listAll()).toHaveLength(1)
  })

  it('部分 upsert 不覆蓋未提供的欄位', async () => {
    const { entries, marketId } = await setup()
    entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [1], noteJson: '{"a":1}' })
    // 只更新 ideal，note 與 actual 應保留
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14', ideal: [2.5, -1] })
    expect(e.actual).toEqual([1])
    expect(e.ideal).toEqual([2.5, -1])
    expect(e.noteJson).toBe('{"a":1}')
  })

  it('沒填的 R 讀出為空陣列；setTrades 可清空', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
    expect(e.actual).toEqual([])
    expect(e.ideal).toEqual([])
    entries.setTrades(e.id, 'actual', [1, 2])
    entries.setTrades(e.id, 'actual', [])
    expect(entries.getById(e.id)?.actual).toEqual([])
  })

  it('setTrades 只收有限數字、四捨五入到兩位小數', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
    entries.setTrades(e.id, 'ideal', [1.234, 'x', null, Infinity, -0.5])
    expect(entries.getById(e.id)?.ideal).toEqual([1.23, -0.5])
  })

  it('listPresenceByMarketInRange：圖片存在旗標、範圍與市場過濾', async () => {
    const { entries, images, markets, marketId } = await setup()
    const other = markets.create('小道瓊')
    const e1 = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [1] })
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
