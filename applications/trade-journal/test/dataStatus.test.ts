import { describe, it, expect } from 'vitest'
import { openDb } from '../server/db/connection'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createImageRepo } from '../server/db/repositories/imageRepo'
import { computeDataStatus } from '../server/utils/dataStatus'

async function setup() {
  const db = await openDb(':memory:')
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const images = createImageRepo(db)
  const m = markets.create('台指期')
  const e1 = entries.upsert({ marketId: m.id, tradeDate: '2026-07-14' })
  const e2 = entries.upsert({ marketId: m.id, tradeDate: '2026-07-15' })
  images.upsert(e1.id, 'trade', 'images/entries/a/trade.png', 1, 1)
  images.upsert(e1.id, 'raw', 'images/entries/a/raw.png', 1, 1)
  images.upsert(e2.id, 'review', 'images/entries/b/review.png', 1, 1)
  return { db, entries, images, e1, e2 }
}
const all = () => true

describe('computeDataStatus', () => {
  it('計算記錄數與各市場筆數', async () => {
    const { db } = await setup()
    const s = computeDataStatus(db, all)
    expect(s.entryCount).toBe(2)
    expect(s.byMarket).toEqual([expect.objectContaining({ name: '台指期', count: 2 })])
  })

  it('圖片總數與缺檔清單', async () => {
    const { db } = await setup()
    const s = computeDataStatus(db, (rel) => !rel.endsWith('raw.png'))
    expect(s.imageCount).toBe(3)
    expect(s.imagePresent).toBe(2)
    expect(s.missing).toEqual([{ marketName: '台指期', tradeDate: '2026-07-14', kind: 'raw' }])
  })

  it('同樣資料 hash 穩定', async () => {
    const { db } = await setup()
    expect(computeDataStatus(db, all).hash).toMatch(/^[0-9a-f]{64}$/)
    expect(computeDataStatus(db, all).hash).toBe(computeDataStatus(db, all).hash)
  })

  it('改 WLT / 空手 / 圖片會改變 hash', async () => {
    const { db, entries, images, e1 } = await setup()
    const h0 = computeDataStatus(db, all).hash
    entries.setWlt(e1.id, 'actual', { w: 1, l: 0, t: 0 })
    const h1 = computeDataStatus(db, all).hash
    expect(h1).not.toBe(h0)
    entries.setNoTrade(e1.id, true)
    const h2 = computeDataStatus(db, all).hash
    expect(h2).not.toBe(h1)
    images.remove(e1.id, 'raw')
    expect(computeDataStatus(db, all).hash).not.toBe(h2)
  })

  it('只改備註或時間戳不影響 hash', async () => {
    const { db, entries, e1 } = await setup()
    const h0 = computeDataStatus(db, all).hash
    entries.setNote(e1.id, 'hello')
    db.prepare(`UPDATE entry SET updated_at = '2030-01-01'`).run()
    expect(computeDataStatus(db, all).hash).toBe(h0)
  })

  it('檔案存在與否不影響 hash', async () => {
    const { db } = await setup()
    expect(computeDataStatus(db, () => false).hash).toBe(computeDataStatus(db, all).hash)
  })
})
