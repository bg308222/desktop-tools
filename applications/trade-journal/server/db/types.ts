export type SqlValue = string | number | bigint | boolean | null | Uint8Array

export type Row = Record<string, SqlValue>
export type BindParams = SqlValue[] | Record<string, SqlValue>

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
  /** 真檔案型 DB 為 no-op（保留介面相容）。 */
  persist(): void
  close(): void
}
