import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Entry, EntryWithPresence, Wlt } from '../../../shared/domain'

interface EntryRow {
  id: string
  market_id: string
  trade_date: string
  actual_w: number | null
  actual_l: number | null
  actual_t: number | null
  ideal_w: number | null
  ideal_l: number | null
  ideal_t: number | null
  would_w: number | null
  would_l: number | null
  would_t: number | null
  no_trade: number
  note_json: string | null
  created_at: string
  updated_at: string
}

function toWlt(w: number | null, l: number | null, t: number | null): Wlt | null {
  if (w == null && l == null && t == null) return null
  return { w: w ?? 0, l: l ?? 0, t: t ?? 0 }
}

const toEntry = (r: EntryRow): Entry => ({
  id: r.id,
  marketId: r.market_id,
  tradeDate: r.trade_date,
  actual: toWlt(r.actual_w, r.actual_l, r.actual_t),
  ideal: toWlt(r.ideal_w, r.ideal_l, r.ideal_t),
  would: toWlt(r.would_w, r.would_l, r.would_t),
  noTrade: !!r.no_trade,
  noteJson: r.note_json,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export interface EntryUpsert {
  marketId: string
  tradeDate: string
  actual?: Wlt | null
  ideal?: Wlt | null
  would?: Wlt | null
  noTrade?: boolean
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

  const setWlt = (id: string, kind: 'actual' | 'ideal' | 'would', v: Wlt | null): void => {
    const cols =
      kind === 'actual'
        ? ['actual_w', 'actual_l', 'actual_t']
        : kind === 'ideal'
          ? ['ideal_w', 'ideal_l', 'ideal_t']
          : ['would_w', 'would_l', 'would_t']
    db.prepare(
      `UPDATE entry SET ${cols[0]} = :w, ${cols[1]} = :l, ${cols[2]} = :t, updated_at = datetime('now') WHERE id = :id`,
    ).run({ id, w: v?.w ?? null, l: v?.l ?? null, t: v?.t ?? null })
  }

  const setNoTrade = (id: string, value: boolean): void => {
    db.prepare(`UPDATE entry SET no_trade = :v, updated_at = datetime('now') WHERE id = :id`).run({
      id,
      v: value ? 1 : 0,
    })
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
      if ('actual' in input) setWlt(e.id, 'actual', input.actual ?? null)
      if ('ideal' in input) setWlt(e.id, 'ideal', input.ideal ?? null)
      if ('would' in input) setWlt(e.id, 'would', input.would ?? null)
      if ('noTrade' in input) setNoTrade(e.id, input.noTrade ?? false)
      if ('noteJson' in input) setNote(e.id, input.noteJson ?? null)
      return getById(e.id) as Entry
    })

  const listInRange = (from: string, to: string): Entry[] =>
    db
      .prepare(`SELECT * FROM entry WHERE trade_date >= :from AND trade_date <= :to ORDER BY trade_date`)
      .all<EntryRow>({ from, to })
      .map(toEntry)

  const listByMarketInRange = (marketId: string, from: string, to: string): Entry[] =>
    db
      .prepare(
        `SELECT * FROM entry WHERE market_id = :m AND trade_date >= :from AND trade_date <= :to ORDER BY trade_date`,
      )
      .all<EntryRow>({ m: marketId, from, to })
      .map(toEntry)

  const listByDate = (date: string): Entry[] =>
    db.prepare(`SELECT * FROM entry WHERE trade_date = :d`).all<EntryRow>({ d: date }).map(toEntry)

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

  const listByTagIds = (tagIds: string[]): Entry[] => {
    if (tagIds.length === 0) return []
    const placeholders = tagIds.map((_, i) => `:t${i}`).join(', ')
    const params: Record<string, string> = {}
    tagIds.forEach((id, i) => {
      params[`t${i}`] = id
    })
    return db
      .prepare(
        `SELECT DISTINCT e.* FROM entry e JOIN entry_tag et ON et.entry_id = e.id WHERE et.tag_id IN (${placeholders}) ORDER BY e.trade_date`,
      )
      .all<EntryRow>(params)
      .map(toEntry)
  }

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
    setWlt,
    setNoTrade,
    setNote,
    listInRange,
    listByMarketInRange,
    listPresenceByMarketInRange,
    listByDate,
    listByTagIds,
    distinctDates,
    remove,
  }
}

export type EntryRepo = ReturnType<typeof createEntryRepo>
