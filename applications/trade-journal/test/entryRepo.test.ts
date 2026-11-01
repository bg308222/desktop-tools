import { describe, it, expect } from 'vitest'
import { openDb } from '../server/db/connection'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createImageRepo } from '../server/db/repositories/imageRepo'
import { emptyTrade, type Trade } from '../shared/trades'

async function setup() {
  const db = await openDb(':memory:')
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const images = createImageRepo(db)
  const m = markets.create('台指期')
  return { db, markets, entries, images, marketId: m.id }
}

const t = (o: Partial<Trade>): Trade => ({ ...emptyTrade(), ...o })

describe('entryRepo', () => {
  it('upsert 同 (market,date) 不重複，會更新', async () => {
    const { entries, marketId } = await setup()
    const a = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [t({ initialTarget: 2 })] })
    const b = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [t({ initialTarget: 3 })] })
    expect(a.id).toBe(b.id)
    expect(b.actual).toEqual([t({ initialTarget: 3 })])
    expect(entries.listAll()).toHaveLength(1)
  })

  it('部分 upsert 不覆蓋未提供的欄位', async () => {
    const { entries, marketId } = await setup()
    entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [t({ initialTarget: 2 })], noteJson: '{"a":1}' })
    // 只更新 ideal，note 與 actual 應保留
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14', ideal: [t({ initialTarget: 2, realized: 2 })] })
    expect(e.actual).toEqual([t({ initialTarget: 2 })])
    expect(e.ideal).toEqual([t({ initialTarget: 2, realized: 2 })])
    expect(e.noteJson).toBe('{"a":1}')
  })

  it('沒有交易讀出為空陣列；setTrades 覆寫、保留順序、可清空', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
    expect(e.actual).toEqual([])
    expect(e.ideal).toEqual([])
    const list = [3, 1, 2].map((v) => t({ initialTarget: v }))
    entries.setTrades(e.id, 'actual', list)
    entries.setTrades(e.id, 'ideal', [t({ initialTarget: 9 })])
    expect(entries.getById(e.id)?.actual).toEqual(list)
    entries.setTrades(e.id, 'actual', [])
    expect(entries.getById(e.id)?.actual).toEqual([])
    expect(entries.getById(e.id)?.ideal).toEqual([t({ initialTarget: 9 })])
  })

  it('setTrades 會整理：違反值域 → null、兩位小數、全空列丟掉', async () => {
    const { entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14' })
    entries.setTrades(e.id, 'ideal', [{ initialTarget: 1.234, paStop: -1, realized: -0.5 }, {}, 'x'])
    expect(entries.getById(e.id)?.ideal).toEqual([t({ initialTarget: 1.23, realized: -0.5 })])
  })

  it('刪除 entry 時交易一併刪除', async () => {
    const { db, entries, marketId } = await setup()
    const e = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [t({ initialTarget: 2 })] })
    entries.remove(e.id)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM trade`).get<{ n: number }>()?.n).toBe(0)
  })

  it('listPresenceByMarketInRange：圖片存在旗標、範圍與市場過濾', async () => {
    const { entries, images, markets, marketId } = await setup()
    const other = markets.create('小道瓊')
    const e1 = entries.upsert({ marketId, tradeDate: '2026-07-14', actual: [t({ initialTarget: 2 })] })
    images.upsert(e1.id, 'trade', 'a.png', null, null)
    images.upsert(e1.id, 'review', 'b.png', null, null)
    entries.upsert({ marketId, tradeDate: '2026-07-15' }) // 無圖
    entries.upsert({ marketId, tradeDate: '2026-08-01' }) // 超出範圍
    entries.upsert({ marketId: other.id, tradeDate: '2026-07-14' }) // 別的市場

    const rows = entries.listPresenceByMarketInRange(marketId, '2026-07-01', '2026-07-31')
    expect(rows.map((r) => r.tradeDate)).toEqual(['2026-07-14', '2026-07-15'])
    expect(rows[0]!.images).toEqual({ trade: true, raw: false, review: true })
    expect(rows[0]!.actual).toEqual([t({ initialTarget: 2 })])
    expect(rows[1]!.actual).toEqual([])
    expect(rows[1]!.images).toEqual({ trade: false, raw: false, review: false })
  })
})
