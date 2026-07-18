import { createDb, type Db } from './sqljs'
import { SCHEMA } from './schema'

export type { Db, Stmt, Row, BindParams } from './sqljs'

/** 開啟 DB 並套用 schema（IF NOT EXISTS，可重複執行）。 */
export async function openDb(source?: string | Uint8Array): Promise<Db> {
  const db = await createDb(source)
  db.exec(SCHEMA)
  return db
}
