import { randomUUID } from 'node:crypto'
import type { Db } from '../connection'
import type { Tag } from '@shared/domain'

interface TagRow {
  id: string
  name: string
  color: string | null
}

export function createTagRepo(db: Db) {
  const list = (): Tag[] => db.prepare(`SELECT id, name, color FROM tag ORDER BY name`).all<TagRow>()

  const ensure = (name: string): Tag => {
    const existing = db.prepare(`SELECT id, name, color FROM tag WHERE name = :name`).get<TagRow>({ name })
    if (existing) return existing
    const id = randomUUID()
    db.prepare(`INSERT INTO tag (id, name) VALUES (:id, :name)`).run({ id, name })
    return { id, name, color: null }
  }

  return {
    list,
    ensure,
    setEntryTags(entryId: string, tagIds: string[]): void {
      db.transaction(() => {
        db.prepare(`DELETE FROM entry_tag WHERE entry_id = :e`).run({ e: entryId })
        for (const tagId of tagIds) {
          db.prepare(`INSERT INTO entry_tag (entry_id, tag_id) VALUES (:e, :t)`).run({ e: entryId, t: tagId })
        }
      })
    },
    getEntryTags(entryId: string): Tag[] {
      return db
        .prepare(
          `SELECT t.id, t.name, t.color FROM tag t
           JOIN entry_tag et ON et.tag_id = t.id
           WHERE et.entry_id = :e ORDER BY t.name`,
        )
        .all<TagRow>({ e: entryId })
    },
  }
}

export type TagRepo = ReturnType<typeof createTagRepo>
