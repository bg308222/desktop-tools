import Database from 'better-sqlite3'
import fs from 'node:fs'
import { dirname } from 'node:path'
import { SCHEMA } from './schema'
import type { Db, Stmt, BindParams } from './types'

export type { Db, Stmt, Row, BindParams } from './types'

/** better-sqlite3 具名參數用 bare key（SQL 內為 :name），移除可能的 :/$/@ 前綴。 */
function normalize(params?: BindParams) {
  if (params == null) return undefined
  if (Array.isArray(params)) return params
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) out[k.replace(/^[:$@]/, '')] = v
  return out
}

/**
 * 開啟 DB 並套用 schema（IF NOT EXISTS，可重複執行）。
 * - undefined / ':memory:' → 記憶體 DB（測試用）
 * - 檔案路徑字串 → 存在則開啟，否則建立（自動建立所屬資料夾）
 */
export function openDb(source?: string): Db {
  const file = source && source !== ':memory:' ? source : ':memory:'
  if (file !== ':memory:') fs.mkdirSync(dirname(file), { recursive: true })
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)

  // migration（冪等）：補上既有 DB 缺少的新欄位、移除已淘汰的欄位
  const cols = (table: string) =>
    new Set((db.pragma(`table_info(${table})`) as { name: string }[]).map((r) => r.name))
  // 交易改存 trade 表（六個欄位）：舊的 WLT、空手、逐筆 R 欄位直接丟掉（不轉換舊資料）
  const entryCols = cols('entry')
  for (const c of ['actual_w', 'actual_l', 'actual_t', 'ideal_w', 'ideal_l', 'ideal_t', 'would_w', 'would_l', 'would_t', 'no_trade', 'actual_r', 'ideal_r'])
    if (entryCols.has(c)) db.exec(`ALTER TABLE entry DROP COLUMN ${c}`)

  // tag 長出內文欄位
  if (!cols('tag').has('body')) db.exec(`ALTER TABLE tag ADD COLUMN body TEXT`)

  // 查詢長出排序欄位
  if (!cols('saved_query').has('sort_order'))
    db.exec(`ALTER TABLE saved_query ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`)

  // rules 併入 tags：移除已淘汰的 rule 相關表（先子後親，冪等）
  for (const t of ['entry_rule_ref', 'rule_image', 'rule', 'rule_group']) {
    db.exec(`DROP TABLE IF EXISTS ${t}`)
  }

  const prepare = (sql: string): Stmt => {
    const st = db.prepare(sql)
    return {
      run(params) {
        if (params === undefined) st.run()
        else st.run(normalize(params) as never)
      },
      get<T = unknown>(params?: BindParams): T | undefined {
        return (params === undefined ? st.get() : st.get(normalize(params) as never)) as T | undefined
      },
      all<T = unknown>(params?: BindParams): T[] {
        return (params === undefined ? st.all() : st.all(normalize(params) as never)) as T[]
      },
    }
  }

  return {
    prepare,
    exec: (sql) => {
      db.exec(sql)
    },
    transaction<T>(fn: () => T): T {
      return db.transaction(fn)()
    },
    persist: () => {},
    close: () => db.close(),
  }
}
