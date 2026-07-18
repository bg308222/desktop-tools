import fs from 'node:fs'
import path from 'node:path'
import initSqlJs, { type Database as SqlJsDatabase, type SqlValue } from 'sql.js'

/** repository 只依賴這個介面，與底層驅動解耦。 */
export interface Stmt {
  run(params?: BindParams): void
  get<T = Row>(params?: BindParams): T | undefined
  all<T = Row>(params?: BindParams): T[]
}

export interface Db {
  prepare(sql: string): Stmt
  exec(sql: string): void
  transaction<T>(fn: () => T): T
  /** 將目前內容寫回檔案（記憶體 DB 為 no-op）。 */
  persist(): void
  close(): void
  readonly raw: SqlJsDatabase
}

export type Row = Record<string, SqlValue>
export type BindParams = SqlValue[] | Record<string, SqlValue>

let sqlPromise: ReturnType<typeof initSqlJs> | null = null

function resolveWasm(): ArrayBuffer {
  const candidates: string[] = []
  try {
    // 執行於 CJS（Electron 打包後的 main）時可用；用 eval 避免打包器靜態改寫。
    const req = (eval('require') as NodeRequire | undefined)
    if (req) candidates.push(path.join(path.dirname(req.resolve('sql.js')), 'sql-wasm.wasm'))
  } catch {
    /* 非 CJS 環境（如 Vitest ESM）忽略 */
  }
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(dir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'))
    dir = path.dirname(dir)
  }
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p)
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
    }
  }
  throw new Error('找不到 sql-wasm.wasm；請確認已安裝 sql.js')
}

async function getSQL() {
  if (!sqlPromise) {
    const wasmBinary = resolveWasm()
    sqlPromise = initSqlJs({ wasmBinary })
  }
  return sqlPromise
}

function normalize(params?: BindParams): BindParams | undefined {
  if (params == null) return undefined
  if (Array.isArray(params)) return params
  const out: Record<string, SqlValue> = {}
  for (const [k, v] of Object.entries(params)) out[`:${k}`] = v
  return out
}

/**
 * 開啟 DB。
 * - ':memory:' 或未給 → 記憶體 DB（測試用）
 * - 檔案路徑字串 → 若存在則載入，否則建新檔（persist 時寫回）
 * - Uint8Array → 由既有 bytes 載入
 */
export async function createDb(source?: string | Uint8Array): Promise<Db> {
  const SQL = await getSQL()
  let raw: SqlJsDatabase
  let filePath: string | undefined

  if (source === undefined || source === ':memory:') {
    raw = new SQL.Database()
  } else if (typeof source === 'string') {
    filePath = source
    raw = fs.existsSync(source) ? new SQL.Database(fs.readFileSync(source)) : new SQL.Database()
  } else {
    raw = new SQL.Database(source)
  }

  raw.run('PRAGMA foreign_keys = ON;')

  const prepare = (sql: string): Stmt => ({
    run(params) {
      raw.run(sql, normalize(params) as never)
    },
    get<T = Row>(params?: BindParams): T | undefined {
      const st = raw.prepare(sql)
      try {
        const p = normalize(params)
        if (p !== undefined) st.bind(p as never)
        return st.step() ? (st.getAsObject() as T) : undefined
      } finally {
        st.free()
      }
    },
    all<T = Row>(params?: BindParams): T[] {
      const st = raw.prepare(sql)
      const rows: T[] = []
      try {
        const p = normalize(params)
        if (p !== undefined) st.bind(p as never)
        while (st.step()) rows.push(st.getAsObject() as T)
      } finally {
        st.free()
      }
      return rows
    },
  })

  return {
    raw,
    prepare,
    exec: (sql) => raw.exec(sql),
    transaction<T>(fn: () => T): T {
      raw.run('BEGIN')
      try {
        const r = fn()
        raw.run('COMMIT')
        return r
      } catch (e) {
        raw.run('ROLLBACK')
        throw e
      }
    },
    persist() {
      if (!filePath) return
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, Buffer.from(raw.export()))
    },
    close: () => raw.close(),
  }
}
