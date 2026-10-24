import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import { sanitizeConditions, type QueryCondition, type SavedQuery } from '../../../shared/query'

interface QueryRow {
  id: string
  name: string
  conditions_json: string
}

function parseConditions(json: string): QueryCondition[] {
  try {
    return sanitizeConditions(JSON.parse(json))
  } catch {
    return []
  }
}

const toQuery = (r: QueryRow): SavedQuery => ({
  id: r.id,
  name: r.name,
  conditions: parseConditions(r.conditions_json),
})

export function createQueryRepo(db: Db) {
  const get = (id: string): SavedQuery | null => {
    const r = db.prepare(`SELECT id, name, conditions_json FROM saved_query WHERE id = :id`).get<QueryRow>({ id })
    return r ? toQuery(r) : null
  }

  return {
    get,
    /** 依建立順序列出。 */
    list(): SavedQuery[] {
      return db
        .prepare(`SELECT id, name, conditions_json FROM saved_query ORDER BY rowid`)
        .all<QueryRow>()
        .map(toQuery)
    },
    create(name: string, conditions: QueryCondition[]): SavedQuery {
      const id = randomUUID()
      db.prepare(`INSERT INTO saved_query (id, name, conditions_json) VALUES (:id, :name, :c)`).run({
        id,
        name,
        c: JSON.stringify(conditions),
      })
      return get(id) as SavedQuery
    },
    update(id: string, patch: { name?: string; conditions?: QueryCondition[] }): SavedQuery | null {
      if (patch.name !== undefined)
        db.prepare(`UPDATE saved_query SET name = :name WHERE id = :id`).run({ id, name: patch.name })
      if (patch.conditions !== undefined)
        db.prepare(`UPDATE saved_query SET conditions_json = :c WHERE id = :id`).run({
          id,
          c: JSON.stringify(patch.conditions),
        })
      return get(id)
    },
    remove(id: string): void {
      db.prepare(`DELETE FROM saved_query WHERE id = :id`).run({ id })
    },
  }
}

export type QueryRepo = ReturnType<typeof createQueryRepo>
