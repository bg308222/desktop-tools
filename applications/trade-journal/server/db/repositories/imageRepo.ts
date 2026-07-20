import { randomUUID } from 'node:crypto'
import type { Db } from '../types'
import type { ImageKind, ImageRec } from '../../../shared/domain'

interface ImageRow {
  id: string
  entry_id: string
  kind: ImageKind
  file_path: string
  width: number | null
  height: number | null
}

const toImage = (r: ImageRow): ImageRec => ({
  id: r.id,
  entryId: r.entry_id,
  kind: r.kind,
  filePath: r.file_path,
  width: r.width,
  height: r.height,
})

export function createImageRepo(db: Db) {
  const get = (entryId: string, kind: ImageKind): ImageRec | null => {
    const r = db
      .prepare(`SELECT * FROM image WHERE entry_id = :e AND kind = :k`)
      .get<ImageRow>({ e: entryId, k: kind })
    return r ? toImage(r) : null
  }

  return {
    get,
    getByEntry(entryId: string): ImageRec[] {
      return db.prepare(`SELECT * FROM image WHERE entry_id = :e`).all<ImageRow>({ e: entryId }).map(toImage)
    },
    upsert(
      entryId: string,
      kind: ImageKind,
      filePath: string,
      width: number | null,
      height: number | null,
    ): ImageRec {
      db.prepare(
        `INSERT INTO image (id, entry_id, kind, file_path, width, height)
         VALUES (:id, :e, :k, :f, :w, :h)
         ON CONFLICT(entry_id, kind) DO UPDATE SET
           file_path = excluded.file_path, width = excluded.width, height = excluded.height`,
      ).run({ id: randomUUID(), e: entryId, k: kind, f: filePath, w: width, h: height })
      return get(entryId, kind) as ImageRec
    },
    remove(entryId: string, kind: ImageKind): void {
      db.prepare(`DELETE FROM image WHERE entry_id = :e AND kind = :k`).run({ e: entryId, k: kind })
    },
    removeByEntry(entryId: string): void {
      db.prepare(`DELETE FROM image WHERE entry_id = :e`).run({ e: entryId })
    },
  }
}

export type ImageRepo = ReturnType<typeof createImageRepo>
