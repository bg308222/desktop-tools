import { describe, it, expect } from 'vitest'
import { openDb } from '../electron/db/connection'

const TABLES = [
  'market',
  'entry',
  'image',
  'tag',
  'entry_tag',
  'rule_group',
  'rule',
  'rule_image',
  'entry_rule_ref',
]

describe('openDb', () => {
  it('建立全部九張資料表', async () => {
    const db = await openDb(':memory:')
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all<{ name: string }>()
    const names = rows.map((r) => r.name)
    for (const t of TABLES) {
      expect(names).toContain(t)
    }
    db.close()
  })

  it('外鍵約束為開啟', async () => {
    const db = await openDb(':memory:')
    const r = db.prepare('PRAGMA foreign_keys').get<{ foreign_keys: number }>()
    expect(r?.foreign_keys).toBe(1)
    db.close()
  })
})
