import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'
import { createMarketRepo } from '../electron/db/repositories/marketRepo'
import { createEntryRepo } from '../electron/db/repositories/entryRepo'
import { createRuleRepo } from '../electron/db/repositories/ruleRepo'

async function setup() {
  const db = await openDb(':memory:')
  const market = createMarketRepo(db).create('台指期')
  const entry = createEntryRepo(db).upsert({ marketId: market.id, tradeDate: '2026-07-14' })
  return { rules: createRuleRepo(db), entryId: entry.id }
}

describe('ruleRepo', () => {
  it('建立群組與規則、更新內容', async () => {
    const { rules } = await setup()
    const g = rules.createGroup('行為白名單')
    const r = rules.createRule(g.id, '只在區間邊緣進場')
    rules.updateRule(r.id, { bodyJson: '{"doc":1}' })
    expect(rules.getRule(r.id)?.bodyJson).toBe('{"doc":1}')
  })

  it('改名後引用仍以 id 存在（改名不失效）', async () => {
    const { rules, entryId } = await setup()
    const g = rules.createGroup('白名單')
    const r = rules.createRule(g.id, '舊名稱')
    rules.setEntryRuleRefs(entryId, [r.id])
    rules.updateRule(r.id, { name: '新名稱' })
    expect(rules.entriesReferencing(r.id)).toEqual([entryId])
    expect(rules.getRule(r.id)?.name).toBe('新名稱')
  })

  it('刪除規則後引用一併移除', async () => {
    const { rules, entryId } = await setup()
    const g = rules.createGroup('白名單')
    const r = rules.createRule(g.id, 'x')
    rules.setEntryRuleRefs(entryId, [r.id])
    rules.deleteRule(r.id)
    expect(rules.entriesReferencing(r.id)).toEqual([])
  })

  it('setEntryRuleRefs 覆寫該 entry 的引用集合', async () => {
    const { rules, entryId } = await setup()
    const g = rules.createGroup('白名單')
    const a = rules.createRule(g.id, 'a')
    const b = rules.createRule(g.id, 'b')
    rules.setEntryRuleRefs(entryId, [a.id, b.id])
    rules.setEntryRuleRefs(entryId, [b.id])
    expect(rules.entriesReferencing(a.id)).toEqual([])
    expect(rules.entriesReferencing(b.id)).toEqual([entryId])
  })
})
