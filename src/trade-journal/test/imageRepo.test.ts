import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'
import { createMarketRepo } from '../electron/db/repositories/marketRepo'
import { createEntryRepo } from '../electron/db/repositories/entryRepo'
import { createImageRepo } from '../electron/db/repositories/imageRepo'

async function setup() {
  const db = await openDb(':memory:')
  const market = createMarketRepo(db).create('台指期')
  const entries = createEntryRepo(db)
  const e = entries.upsert({ marketId: market.id, tradeDate: '2026-07-14' })
  return { images: createImageRepo(db), entryId: e.id }
}

describe('imageRepo', () => {
  it('同 (entry,kind) upsert 覆蓋而非新增', async () => {
    const { images, entryId } = await setup()
    images.upsert(entryId, 'trade', 'images/entries/x/trade.png', 100, 80)
    const rec = images.upsert(entryId, 'trade', 'images/entries/x/trade.png', 120, 90)
    expect(images.getByEntry(entryId)).toHaveLength(1)
    expect(rec.width).toBe(120)
    expect(rec.height).toBe(90)
  })

  it('可存三種 kind、remove 移除單一', async () => {
    const { images, entryId } = await setup()
    images.upsert(entryId, 'trade', 'a.png', 1, 1)
    images.upsert(entryId, 'raw', 'b.png', 1, 1)
    images.upsert(entryId, 'review', 'c.png', 1, 1)
    expect(images.getByEntry(entryId)).toHaveLength(3)
    images.remove(entryId, 'raw')
    expect(images.get(entryId, 'raw')).toBeNull()
    expect(images.getByEntry(entryId)).toHaveLength(2)
  })
})
