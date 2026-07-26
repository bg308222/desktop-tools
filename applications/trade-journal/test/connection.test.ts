import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { openDb } from '../server/db/connection'

const TABLES = ['market', 'entry', 'image', 'tag', 'entry_tag', 'tag_image']

describe('openDb', () => {
  it('建立全部資料表', async () => {
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

  it('tag 具備 body、tag_image 存在、rule 相關表已移除', async () => {
    const db = await openDb(':memory:')
    const tagCols = db
      .prepare(`SELECT name FROM pragma_table_info('tag')`)
      .all<{ name: string }>()
      .map((r) => r.name)
    expect(tagCols).toContain('body')
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
      .all<{ name: string }>()
      .map((r) => r.name)
    expect(tables).toContain('tag_image')
    for (const t of ['rule', 'rule_group', 'rule_image', 'entry_rule_ref'])
      expect(tables).not.toContain(t)
    db.close()
  })

  it('entry 具備 no_trade 與 would 欄位', async () => {
    const db = await openDb(':memory:')
    const cols = db
      .prepare(`SELECT name FROM pragma_table_info('entry')`)
      .all<{ name: string }>()
      .map((r) => r.name)
    for (const c of ['no_trade', 'would_w', 'would_l', 'would_t']) expect(cols).toContain(c)
    db.close()
  })

  it('舊 DB 缺欄位時 migration 會補上且保留資料', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-mig-'))
    const file = path.join(dir, 'old.db')
    // 用舊 schema（無新欄位）建一筆
    const raw = new Database(file)
    raw.exec(
      `CREATE TABLE entry (id TEXT PRIMARY KEY, market_id TEXT NOT NULL, trade_date TEXT NOT NULL,
        actual_w INTEGER, actual_l INTEGER, actual_t INTEGER, ideal_w INTEGER, ideal_l INTEGER, ideal_t INTEGER,
        note_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (market_id, trade_date))`,
    )
    raw.prepare(`INSERT INTO entry (id, market_id, trade_date) VALUES ('e1','m1','2026-07-14')`).run()
    raw.close()
    // openDb 應補欄位、保留資料、no_trade 預設 0
    const db = await openDb(file)
    const row = db
      .prepare(`SELECT id, no_trade, would_w FROM entry WHERE id = 'e1'`)
      .get<{ id: string; no_trade: number; would_w: number | null }>()
    expect(row?.id).toBe('e1')
    expect(row?.no_trade).toBe(0)
    expect(row?.would_w).toBeNull()
    db.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
