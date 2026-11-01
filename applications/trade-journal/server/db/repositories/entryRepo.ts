import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Entry, EntryWithPresence } from '../../../shared/domain'
import { sanitizeTrades, type Trade, type TradeKind } from '../../../shared/trades'

interface EntryRow {
  id: string
  market_id: string
  trade_date: string
  note_json: string | null
  created_at: string
  updated_at: string
}

interface TradeRow {
  entry_id: string
  kind: TradeKind
  initial_target: number | null
  pa_stop: number | null
  pa_target: number | null
  realized: number | null
  mfe: number | null
}

type Trades = Record<TradeKind, Trade[]>

const toTrade = (r: TradeRow): Trade => ({
  initialTarget: r.initial_target,
  paStop: r.pa_stop,
  paTarget: r.pa_target,
  realized: r.realized,
  mfe: r.mfe,
})

const toEntry = (r: EntryRow, trades: Trades | undefined): Entry => ({
  id: r.id,
  marketId: r.market_id,
  tradeDate: r.trade_date,
  actual: trades?.actual ?? [],
  ideal: trades?.ideal ?? [],
  noteJson: r.note_json,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export interface EntryUpsert {
  marketId: string
  tradeDate: string
  actual?: Trade[]
  ideal?: Trade[]
  noteJson?: string | null
}

export function createEntryRepo(db: Db) {
  /** 一次撈出指定 entry（不給＝全部）的交易，依 entry 分組、各 kind 依 seq 排序。 */
  const loadTrades = (entryIds?: string[]): Map<string, Trades> => {
    const rows =
      entryIds == null
        ? db.prepare(`SELECT * FROM trade ORDER BY entry_id, kind, seq`).all<TradeRow>()
        : entryIds.length === 0
          ? []
          : db
              .prepare(
                `SELECT * FROM trade WHERE entry_id IN (SELECT value FROM json_each(:ids))
                 ORDER BY entry_id, kind, seq`,
              )
              .all<TradeRow>({ ids: JSON.stringify(entryIds) })
    const out = new Map<string, Trades>()
    for (const r of rows) {
      let t = out.get(r.entry_id)
      if (!t) out.set(r.entry_id, (t = { actual: [], ideal: [] }))
      t[r.kind].push(toTrade(r))
    }
    return out
  }

  /** entry 列 → Entry（附交易）。 */
  const withTrades = (rows: EntryRow[], all = false): Entry[] => {
    const trades = loadTrades(all ? undefined : rows.map((r) => r.id))
    return rows.map((r) => toEntry(r, trades.get(r.id)))
  }

  const get = (marketId: string, date: string): Entry | null => {
    const r = db
      .prepare(`SELECT * FROM entry WHERE market_id = :m AND trade_date = :d`)
      .get<EntryRow>({ m: marketId, d: date })
    return r ? withTrades([r])[0]! : null
  }

  const getById = (id: string): Entry | null => {
    const r = db.prepare(`SELECT * FROM entry WHERE id = :id`).get<EntryRow>({ id })
    return r ? withTrades([r])[0]! : null
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

  /** 覆寫某一組交易（實際或理想）：整理後依序重寫，全空的列丟掉。 */
  const setTrades = (id: string, kind: TradeKind, trades: unknown): void =>
    db.transaction(() => {
      db.prepare(`DELETE FROM trade WHERE entry_id = :id AND kind = :kind`).run({ id, kind })
      const ins = db.prepare(
        `INSERT INTO trade (id, entry_id, kind, seq, initial_target, pa_stop, pa_target, realized, mfe)
         VALUES (:tid, :id, :kind, :seq, :initialTarget, :paStop, :paTarget, :realized, :mfe)`,
      )
      sanitizeTrades(trades).forEach((t, seq) => ins.run({ tid: randomUUID(), id, kind, seq, ...t }))
      db.prepare(`UPDATE entry SET updated_at = datetime('now') WHERE id = :id`).run({ id })
    })

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
  ): EntryWithPresence[] => {
    const rows = db
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
    const trades = loadTrades(rows.map((r) => r.id))
    return rows.map((r) => ({
      ...toEntry(r, trades.get(r.id)),
      images: { trade: !!r.has_trade, raw: !!r.has_raw, review: !!r.has_review },
    }))
  }

  /** 全部 entry（供查詢比對）。 */
  const listAll = (): Entry[] =>
    withTrades(db.prepare(`SELECT * FROM entry ORDER BY trade_date`).all<EntryRow>(), true)

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
