import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'
import { createMarketRepo } from '../electron/db/repositories/marketRepo'
import { createEntryRepo } from '../electron/db/repositories/entryRepo'
import { createTagRepo } from '../electron/db/repositories/tagRepo'

async function setup() {
  const db = await openDb(':memory:')
  const market = createMarketRepo(db).create('台指期')
  const e = createEntryRepo(db).upsert({ marketId: market.id, tradeDate: '2026-07-14' })
  return { tags: createTagRepo(db), entryId: e.id }
}

describe('tagRepo', () => {
  it('ensure 同名不重複', async () => {
    const { tags } = await setup()
    const a = tags.ensure('順勢')
    const b = tags.ensure('順勢')
    expect(a.id).toBe(b.id)
    expect(tags.list()).toHaveLength(1)
  })

  it('setEntryTags 覆寫關聯，getEntryTags 反映', async () => {
    const { tags, entryId } = await setup()
    const t1 = tags.ensure('順勢')
    const t2 = tags.ensure('突破')
    const t3 = tags.ensure('假突破')
    tags.setEntryTags(entryId, [t1.id, t2.id])
    expect(tags.getEntryTags(entryId).map((t) => t.name).sort()).toEqual(['突破', '順勢'])
    tags.setEntryTags(entryId, [t3.id])
    expect(tags.getEntryTags(entryId).map((t) => t.name)).toEqual(['假突破'])
  })
})
