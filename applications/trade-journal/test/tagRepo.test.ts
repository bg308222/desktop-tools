import { describe, it, expect } from 'vitest'
import { openDb } from '../server/db/connection'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createTagRepo } from '../server/db/repositories/tagRepo'

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

  it('setBody 與 list/getEntryTags 帶出 body', async () => {
    const { tags, entryId } = await setup()
    const t = tags.ensure('只在區間邊緣進場')
    expect(t.body).toBeNull()
    tags.setBody(t.id, '觸及區間上下緣才進場。')
    expect(tags.list()[0]!.body).toBe('觸及區間上下緣才進場。')
    tags.setEntryTags(entryId, [t.id])
    expect(tags.getEntryTags(entryId)[0]!.body).toBe('觸及區間上下緣才進場。')
  })

  it('addImage / listImages / removeImage', async () => {
    const { tags } = await setup()
    const t = tags.ensure('突破')
    const img = tags.addImage(t.id, 'images/tags/x/a.png')
    expect(tags.listImages(t.id)).toHaveLength(1)
    expect(img.tagId).toBe(t.id)
    tags.removeImage(img.id)
    expect(tags.listImages(t.id)).toHaveLength(0)
  })
})
