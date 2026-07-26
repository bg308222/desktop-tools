import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { Tag, TagImage } from '../../../shared/domain'

interface TagRow {
  id: string
  name: string
  color: string | null
  body: string | null
}
interface TagImageRow {
  id: string
  tag_id: string
  file_path: string
  sort_order: number
}

const toTagImage = (r: TagImageRow): TagImage => ({
  id: r.id,
  tagId: r.tag_id,
  filePath: r.file_path,
  sortOrder: r.sort_order,
})

const TAG_COLS = `id, name, color, body`

export function createTagRepo(db: Db) {
  const list = (): Tag[] => db.prepare(`SELECT ${TAG_COLS} FROM tag ORDER BY name`).all<Tag>()

  const ensure = (name: string): Tag => {
    const existing = db.prepare(`SELECT ${TAG_COLS} FROM tag WHERE name = :name`).get<Tag>({ name })
    if (existing) return existing
    const id = randomUUID()
    db.prepare(`INSERT INTO tag (id, name) VALUES (:id, :name)`).run({ id, name })
    return { id, name, color: null, body: null }
  }

  const nextOrder = (tagId: string): number =>
    db
      .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM tag_image WHERE tag_id = :t`)
      .get<{ n: number }>({ t: tagId })?.n ?? 0

  return {
    list,
    ensure,
    setColor(id: string, color: string | null): void {
      db.prepare(`UPDATE tag SET color = :c WHERE id = :id`).run({ id, c: color })
    },
    rename(id: string, name: string): void {
      db.prepare(`UPDATE tag SET name = :name WHERE id = :id`).run({ id, name })
    },
    setBody(id: string, body: string | null): void {
      db.prepare(`UPDATE tag SET body = :b WHERE id = :id`).run({ id, b: body })
    },
    remove(id: string): void {
      db.prepare(`DELETE FROM tag WHERE id = :id`).run({ id })
    },
    addImage(tagId: string, filePath: string): TagImage {
      const id = randomUUID()
      const so = nextOrder(tagId)
      db.prepare(
        `INSERT INTO tag_image (id, tag_id, file_path, sort_order) VALUES (:id, :t, :f, :so)`,
      ).run({ id, t: tagId, f: filePath, so })
      return { id, tagId, filePath, sortOrder: so }
    },
    listImages(tagId: string): TagImage[] {
      return db
        .prepare(`SELECT * FROM tag_image WHERE tag_id = :t ORDER BY sort_order`)
        .all<TagImageRow>({ t: tagId })
        .map(toTagImage)
    },
    removeImage(id: string): void {
      db.prepare(`DELETE FROM tag_image WHERE id = :id`).run({ id })
    },
    setEntryTags(entryId: string, tagIds: string[]): void {
      db.transaction(() => {
        db.prepare(`DELETE FROM entry_tag WHERE entry_id = :e`).run({ e: entryId })
        for (const tagId of tagIds) {
          db.prepare(`INSERT INTO entry_tag (entry_id, tag_id) VALUES (:e, :t)`).run({
            e: entryId,
            t: tagId,
          })
        }
      })
    },
    getEntryTags(entryId: string): Tag[] {
      return db
        .prepare(
          `SELECT t.${TAG_COLS.split(', ').join(', t.')} FROM tag t
           JOIN entry_tag et ON et.tag_id = t.id
           WHERE et.entry_id = :e ORDER BY t.name`,
        )
        .all<Tag>({ e: entryId })
    },
  }
}

export type TagRepo = ReturnType<typeof createTagRepo>
