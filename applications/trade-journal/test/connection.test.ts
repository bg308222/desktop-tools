import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { openDb } from '../server/db/connection'
import { createEntryRepo } from '../server/db/repositories/entryRepo'

const TABLES = ['market', 'entry', 'image', 'tag', 'entry_tag', 'tag_image', 'saved_query']
const OLD_ENTRY_COLS = ['actual_w', 'actual_l', 'actual_t', 'ideal_w', 'ideal_l', 'ideal_t', 'would_w', 'would_l', 'would_t', 'no_trade']

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

  it('entry 具備 actual_r / ideal_r，沒有 WLT、空手、would 欄位', async () => {
    const db = await openDb(':memory:')
    const cols = db
      .prepare(`SELECT name FROM pragma_table_info('entry')`)
      .all<{ name: string }>()
      .map((r) => r.name)
    expect(cols).toEqual(expect.arrayContaining(['actual_r', 'ideal_r']))
    for (const c of OLD_ENTRY_COLS) expect(cols).not.toContain(c)
    db.close()
  })

  it('舊 DB 的 WLT／空手／would 欄位會被移除，其餘資料保留且可讀寫 R', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-old-'))
    const file = path.join(dir, 'old.db')
    const raw = new Database(file)
    raw.exec(
      `CREATE TABLE market (id TEXT PRIMARY KEY, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
       CREATE TABLE entry (id TEXT PRIMARY KEY, market_id TEXT NOT NULL REFERENCES market(id) ON DELETE CASCADE,
        trade_date TEXT NOT NULL, actual_w INTEGER, actual_l INTEGER, actual_t INTEGER,
        ideal_w INTEGER, ideal_l INTEGER, ideal_t INTEGER, would_w INTEGER, would_l INTEGER, would_t INTEGER,
        no_trade INTEGER NOT NULL DEFAULT 0, note_json TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (market_id, trade_date));
       INSERT INTO market (id, name) VALUES ('m1', 'NQ');
       INSERT INTO entry (id, market_id, trade_date, actual_w, no_trade, note_json)
         VALUES ('e1', 'm1', '2026-07-14', 2, 1, 'hi');`,
    )
    raw.close()
    const db = await openDb(file)
    const cols = db
      .prepare(`SELECT name FROM pragma_table_info('entry')`)
      .all<{ name: string }>()
      .map((r) => r.name)
    for (const c of OLD_ENTRY_COLS) expect(cols).not.toContain(c)
    const entries = createEntryRepo(db)
    expect(entries.getById('e1')).toMatchObject({ noteJson: 'hi', actual: [], ideal: [] })
    entries.setTrades('e1', 'ideal', [3])
    expect(entries.getById('e1')!.ideal).toEqual([3])
    db.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('既有 saved_query 缺 sort_order 時會補上', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tj-sq-'))
    const file = path.join(dir, 'old.db')
    const raw = new Database(file)
    raw.exec(
      `CREATE TABLE saved_query (id TEXT PRIMARY KEY, name TEXT NOT NULL,
        conditions_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL DEFAULT (datetime('now')));
       INSERT INTO saved_query (id, name) VALUES ('q1', 'x');`,
    )
    raw.close()
    const db = await openDb(file)
    const row = db.prepare(`SELECT id, sort_order FROM saved_query`).get<{ id: string; sort_order: number }>()
    expect(row).toEqual({ id: 'q1', sort_order: 0 })
    db.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
