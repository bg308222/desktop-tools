import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createImageStore } from '../electron/images/imageStore'

// 1x1 PNG
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const roots: string[] = []
function tmpRoot(): string {
  const r = path.join(os.tmpdir(), 'tj-test-' + randomUUID())
  roots.push(r)
  return r
}

afterEach(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true })
  roots.length = 0
})

describe('imageStore', () => {
  it('writeEntryImage 寫檔、回傳相對路徑與尺寸', () => {
    const store = createImageStore(tmpRoot())
    const res = store.writeEntryImage('e1', 'trade', PNG_1x1, 'png')
    expect(res.filePath).toBe(path.join('images', 'entries', 'e1', 'trade.png'))
    expect(res.width).toBe(1)
    expect(res.height).toBe(1)
    expect(fs.existsSync(store.absPath(res.filePath))).toBe(true)
  })

  it('deleteFile 移除檔案', () => {
    const store = createImageStore(tmpRoot())
    const res = store.writeEntryImage('e1', 'raw', PNG_1x1, 'png')
    store.deleteFile(res.filePath)
    expect(fs.existsSync(store.absPath(res.filePath))).toBe(false)
  })

  it('readBuffer 讀回內容，遺失回 null', () => {
    const store = createImageStore(tmpRoot())
    const res = store.writeEntryImage('e1', 'review', PNG_1x1, 'png')
    expect(store.readBuffer(res.filePath)?.length).toBe(PNG_1x1.length)
    expect(store.readBuffer('images/nope.png')).toBeNull()
  })
})
