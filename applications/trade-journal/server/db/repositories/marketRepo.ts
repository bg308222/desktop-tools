import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Market } from '../../../shared/domain'

interface MarketRow {
  id: string
  name: string
  sort_order: number
  archived: number
}

const toMarket = (r: MarketRow): Market => ({
  id: r.id,
  name: r.name,
  sortOrder: r.sort_order,
  archived: !!r.archived,
})

export function createMarketRepo(db: Db) {
  return {
    list(): Market[] {
      return db
        .prepare(`SELECT id, name, sort_order, archived FROM market ORDER BY sort_order, name`)
        .all<MarketRow>()
        .map(toMarket)
    },
    create(name: string): Market {
      const next = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM market`).get<{ n: number }>()
      const sortOrder = next?.n ?? 0
      const id = randomUUID()
      db.prepare(`INSERT INTO market (id, name, sort_order) VALUES (:id, :name, :so)`).run({
        id,
        name,
        so: sortOrder,
      })
      return { id, name, sortOrder, archived: false }
    },
    rename(id: string, name: string): void {
      db.prepare(`UPDATE market SET name = :name WHERE id = :id`).run({ id, name })
    },
    reorder(ids: string[]): void {
      db.transaction(() => {
        ids.forEach((id, i) => db.prepare(`UPDATE market SET sort_order = :so WHERE id = :id`).run({ id, so: i }))
      })
    },
    setArchived(id: string, archived: boolean): void {
      db.prepare(`UPDATE market SET archived = :a WHERE id = :id`).run({ id, a: archived ? 1 : 0 })
    },
  }
}

export type MarketRepo = ReturnType<typeof createMarketRepo>
