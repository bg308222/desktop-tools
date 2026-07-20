import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { imageSize } from 'image-size'
import type { ImageKind } from '../../shared/domain'

export interface WrittenImage {
  filePath: string // 相對於 root
  width: number | null
  height: number | null
}

export function createImageStore(root: string) {
  const absPath = (rel: string): string => path.join(root, rel)

  const write = (rel: string, buffer: Buffer): void => {
    const full = absPath(rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, buffer)
  }

  const dims = (buffer: Buffer): { width: number | null; height: number | null } => {
    try {
      const d = imageSize(buffer)
      return { width: d.width ?? null, height: d.height ?? null }
    } catch {
      return { width: null, height: null }
    }
  }

  return {
    absPath,
    writeEntryImage(entryId: string, kind: ImageKind, buffer: Buffer, ext: string): WrittenImage {
      const rel = path.join('images', 'entries', entryId, `${kind}.${ext}`)
      write(rel, buffer)
      return { filePath: rel, ...dims(buffer) }
    },
    writeRuleImage(ruleId: string, buffer: Buffer, ext: string): WrittenImage {
      const rel = path.join('images', 'rules', ruleId, `${randomUUID()}.${ext}`)
      write(rel, buffer)
      return { filePath: rel, ...dims(buffer) }
    },
    deleteFile(rel: string): void {
      const full = absPath(rel)
      if (fs.existsSync(full)) fs.unlinkSync(full)
    },
    readBuffer(rel: string): Buffer | null {
      const full = absPath(rel)
      return fs.existsSync(full) ? fs.readFileSync(full) : null
    },
  }
}

export type ImageStore = ReturnType<typeof createImageStore>
