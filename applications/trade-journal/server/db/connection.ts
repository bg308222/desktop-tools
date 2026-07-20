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
