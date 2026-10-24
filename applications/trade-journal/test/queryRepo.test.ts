import { describe, it, expect } from 'vitest'
import { openDb } from '../server/db/connection'
import { createQueryRepo } from '../server/db/repositories/queryRepo'
import { createMarketRepo } from '../server/db/repositories/marketRepo'
import { createEntryRepo } from '../server/db/repositories/entryRepo'
import { createImageRepo } from '../server/db/repositories/imageRepo'
import { createTagRepo } from '../server/db/repositories/tagRepo'
import { runQuery } from '../server/utils/runQuery'

describe('queryRepo', () => {
  it('create / list / update / remove，條件以 JSON 存取', () => {
    const queries = createQueryRepo(openDb(':memory:'))
    const a = queries.create('開盤整理', [{ kind: 'tag', mode: 'all', tagIds: ['t1'] }])
    const b = queries.create('NQ', [{ kind: 'market', marketIds: ['m1'] }])
    expect(queries.list().map((q) => q.name)).toEqual(['開盤整理', 'NQ'])
    expect(queries.get(a.id)?.conditions).toEqual([{ kind: 'tag', mode: 'all', tagIds: ['t1'] }])

    const u = queries.update(a.id, { name: '開盤整理+MM', conditions: [] })
    expect(u).toEqual({ id: a.id, name: '開盤整理+MM', conditions: [] })
    expect(queries.update('nope', { name: 'x' })).toBeNull()

    queries.remove(b.id)
    expect(queries.list().map((q) => q.id)).toEqual([a.id])
  })

  it('DB 內壞掉的 JSON 讀成空條件', () => {
    const db = openDb(':memory:')
    db.prepare(`INSERT INTO saved_query (id, name, conditions_json) VALUES ('q', 'x', '{bad')`).run()
    expect(createQueryRepo(db).get('q')?.conditions).toEqual([])
  })
})

describe('runQuery', () => {
  function setup() {
    const db = openDb(':memory:')
    const markets = createMarketRepo(db)
    const entries = createEntryRepo(db)
    const images = createImageRepo(db)
    const tags = createTagRepo(db)
    const nq = markets.create('NQ')
    const cl = markets.create('CL')
    const t1 = tags.ensure('101-開盤整理')
    const t2 = tags.ensure('111-達到MM')
    const e1 = entries.upsert({ marketId: cl.id, tradeDate: '2026-10-09' })
    const e2 = entries.upsert({ marketId: nq.id, tradeDate: '2026-10-09' })
    const e3 = entries.upsert({ marketId: nq.id, tradeDate: '2026-10-08' })
    tags.setEntryTags(e1.id, [t1.id, t2.id])
    tags.setEntryTags(e2.id, [t1.id])
    images.upsert(e1.id, 'raw', 'r.png', null, null)
    images.upsert(e1.id, 'review', 'v.png', null, null)
    const run = (conds: Parameters<typeof runQuery>[1]) =>
      runQuery(
        {
          entries: entries.listAllPresence(),
          entryTags: tags.entryTagMap(),
          tagIds: new Set(tags.list().map((t) => t.id)),
          marketOrder: markets.list().map((m) => m.id),
        },
        conds,
      ).map((e) => e.id)
    return { run, tags, t1, t2, nq, e1, e2, e3 }
  }

  it('依日期、同日依市場順序排序；無條件回全部', () => {
    const { run, e1, e2, e3 } = setup()
    expect(run([])).toEqual([e3.id, e2.id, e1.id])
  })

  it('標籤 + 市場 + 狀態組合', () => {
    const { run, t1, t2, nq, e1, e2 } = setup()
    expect(run([{ kind: 'tag', mode: 'all', tagIds: [t1.id, t2.id] }])).toEqual([e1.id])
    expect(
      run([
        { kind: 'tag', mode: 'any', tagIds: [t1.id] },
        { kind: 'market', marketIds: [nq.id] },
      ]),
    ).toEqual([e2.id])
    expect(run([{ kind: 'status', statuses: ['notrade_reviewed'] }])).toEqual([e1.id])
  })

  it('已刪除的標籤會被忽略', () => {
    const { run, tags, t1, t2, e1, e2 } = setup()
    tags.remove(t2.id)
    expect(run([{ kind: 'tag', mode: 'all', tagIds: [t1.id, t2.id] }])).toEqual([e2.id, e1.id])
  })
})
