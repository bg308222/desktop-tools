import { createHash } from 'node:crypto'
import type { Db } from '../db/types'
import type { DataStatus, ImageKind } from '../../shared/domain'

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
}
interface ImageRow {
  entry_id: string
  kind: ImageKind
  file_path: string
}

/**
 * 計算資料狀態。
 * 指紋只取內容欄位，刻意排除 created_at / updated_at 等時間戳，
 * 並依 (market_id, trade_date)、kind 排序，確保同樣的資料永遠得到同一個 hash。
 */
export function computeDataStatus(db: Db, fileExists: (rel: string) => boolean): DataStatus {
  const markets = db.prepare(`SELECT id, name FROM market ORDER BY sort_order, created_at`).all<{
    id: string
    name: string
  }>()
  const marketName = new Map(markets.map((m) => [m.id, m.name]))

  const entries = db
    .prepare(
      `SELECT id, market_id, trade_date, actual_w, actual_l, actual_t, ideal_w, ideal_l, ideal_t,
              would_w, would_l, would_t, no_trade
       FROM entry ORDER BY market_id, trade_date`,
    )
    .all<EntryRow>()
  const images = db
    .prepare(`SELECT entry_id, kind, file_path FROM image ORDER BY entry_id, kind`)
    .all<ImageRow>()

  const imagesByEntry = new Map<string, ImageRow[]>()
  for (const img of images) {
    const list = imagesByEntry.get(img.entry_id) ?? []
    list.push(img)
    imagesByEntry.set(img.entry_id, list)
  }

  const hash = createHash('sha256')
  for (const e of entries) {
    const line = [
      e.market_id,
      e.trade_date,
      [e.actual_w, e.actual_l, e.actual_t],
      [e.ideal_w, e.ideal_l, e.ideal_t],
      [e.would_w, e.would_l, e.would_t],
      e.no_trade ? 1 : 0,
      (imagesByEntry.get(e.id) ?? []).map((i) => [i.kind, i.file_path.replace(/\\/g, '/')]),
    ]
    hash.update(JSON.stringify(line) + '\n')
  }

  const entryById = new Map(entries.map((e) => [e.id, e]))
  const missing: DataStatus['missing'] = []
  for (const img of images) {
    if (fileExists(img.file_path)) continue
    const e = entryById.get(img.entry_id)
    missing.push({
      marketName: (e && marketName.get(e.market_id)) ?? '—',
      tradeDate: e?.trade_date ?? '—',
      kind: img.kind,
    })
  }
  missing.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))

  const counts = new Map<string, number>()
  for (const e of entries) counts.set(e.market_id, (counts.get(e.market_id) ?? 0) + 1)

  return {
    entryCount: entries.length,
    byMarket: markets.map((m) => ({ marketId: m.id, name: m.name, count: counts.get(m.id) ?? 0 })),
    hash: hash.digest('hex'),
    imageCount: images.length,
    imagePresent: images.length - missing.length,
    missing,
  }
}
