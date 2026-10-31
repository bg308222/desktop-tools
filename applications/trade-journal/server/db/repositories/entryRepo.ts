import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Entry, EntryWithPresence } from '../../../shared/domain'
import { sanitizeTrades, type TradeKind } from '../../../shared/trades'

interface EntryRow {
  id: string
  market_id: string
  trade_date: string
  actual_r: string | null
  ideal_r: string | null
  note_json: string | null
  created_at: string
  updated_at: string
}

/** DB 內的 R 陣列 JSON；null 或壞資料都當 0 筆。 */
function toTrades(json: string | null): number[] {
  if (!json) return []
  try {
    return sanitizeTrades(JSON.parse(json))
  } catch {
    return []
  }
}

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  marketId: r.market_id,
  tradeDate: r.trade_date,
  actual: toTrades(r.actual_r),
  ideal: toTrades(r.ideal_r),
  noteJson: r.note_json,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export interface EntryUpsert {
  marketId: string
  tradeDate: string
  actual?: number[]
  ideal?: number[]
  noteJson?: string | null
}

export function createEntryRepo(db: Db) {
  const get = (marketId: string, date: string): Entry | null => {
    const r = db
      .prepare(`SELECT * FROM entry WHERE market_id = :m AND trade_date = :d`)
      .get<EntryRow>({ m: marketId, d: date })
    return r ? toEntry(r) : null
  }

  const getById = (id: string): Entry | null => {
    const r = db.prepare(`SELECT * FROM entry WHERE id = :id`).get<EntryRow>({ id })
    return r ? toEntry(r) : null
  }

  const ensure = (marketId: string, date: string): Entry => {
    const existing = get(marketId, date)
    if (existing) return existing
    const id = randomUUID()
    db.prepare(`INSERT INTO entry (id, market_id, trade_date) VALUES (:id, :m, :d)`).run({
      id,
      m: marketId,
      d: date,
    })
    return get(marketId, date) as Entry
  }

  /** 覆寫某一組逐筆 R；空陣列存成 NULL。 */
  const setTrades = (id: string, kind: TradeKind, rs: unknown): void => {
    const clean = sanitizeTrades(rs)
    db.prepare(
      `UPDATE entry SET ${kind === 'actual' ? 'actual_r' : 'ideal_r'} = :v, updated_at = datetime('now') WHERE id = :id`,
    ).run({ id, v: clean.length ? JSON.stringify(clean) : null })
  }

  const setNote = (id: string, noteJson: string | null): void => {
    db.prepare(`UPDATE entry SET note_json = :n, updated_at = datetime('now') WHERE id = :id`).run({
      id,
      n: noteJson,
    })
  }

  const upsert = (input: EntryUpsert): Entry =>
    db.transaction(() => {
      const e = ensure(input.marketId, input.tradeDate)
      if ('actual' in input) setTrades(e.id, 'actual', input.actual)
      if ('ideal' in input) setTrades(e.id, 'ideal', input.ideal)
      if ('noteJson' in input) setNote(e.id, input.noteJson ?? null)
      return getById(e.id) as Entry
    })

  /** 某市場、某日期範圍的 entry，附帶三種圖是否存在（供總覽算狀態）。 */
  const listPresenceByMarketInRange = (
    marketId: string,
    from: string,
    to: string,
  ): EntryWithPresence[] =>
    db
      .prepare(
        `SELECT e.*,
           MAX(CASE WHEN i.kind = 'trade'  THEN 1 ELSE 0 END) AS has_trade,
           MAX(CASE WHEN i.kind = 'raw'    THEN 1 ELSE 0 END) AS has_raw,
           MAX(CASE WHEN i.kind = 'review' THEN 1 ELSE 0 END) AS has_review
         FROM entry e
         LEFT JOIN image i ON i.entry_id = e.id
         WHERE e.market_id = :m AND e.trade_date >= :from AND e.trade_date <= :to
         GROUP BY e.id
         ORDER BY e.trade_date`,
      )
      .all<EntryRow & { has_trade: number; has_raw: number; has_review: number }>({
        m: marketId,
        from,
        to,
      })
      .map((r) => ({
        ...toEntry(r),
        images: { trade: !!r.has_trade, raw: !!r.has_raw, review: !!r.has_review },
      }))

  /** 全部 entry（供查詢比對）。 */
  const listAll = (): Entry[] =>
    db.prepare(`SELECT * FROM entry ORDER BY trade_date`).all<EntryRow>().map(toEntry)

  const remove = (id: string): void => {
    db.prepare(`DELETE FROM entry WHERE id = :id`).run({ id })
  }

  /** 所有「有記錄」的日期（不分市場，去重、排序）——供復盤日曆停用無資料日。 */
  const distinctDates = (): string[] =>
    db
      .prepare(`SELECT DISTINCT trade_date FROM entry ORDER BY trade_date`)
      .all<{ trade_date: string }>()
      .map((r) => r.trade_date)

  return {
    get,
    getById,
    ensure,
    upsert,
    setTrades,
    setNote,
    listPresenceByMarketInRange,
    listAll,
    distinctDates,
    remove,
  }
}

export type EntryRepo = ReturnType<typeof createEntryRepo>
