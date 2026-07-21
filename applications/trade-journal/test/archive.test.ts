import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { packDir, extractTgzTo } from '../server/utils/archive'

const dirs: string[] = []
function tmp(): string {
  const d = path.join(os.tmpdir(), 'tj-arch-' + randomUUID())
  fs.mkdirSync(d, { recursive: true })
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs) fs.rmSync(d, { recursive: true, force: true })
  dirs.length = 0
})

describe('archive', () => {
  it('packDir → extractTgzTo 內容一致', async () => {
    const src = tmp()
    fs.mkdirSync(path.join(src, 'images', 'entries'), { recursive: true })
    fs.writeFileSync(path.join(src, 'journal.db'), 'DBDATA')
    fs.writeFileSync(path.join(src, 'images', 'entries', 'a.png'), 'PNG')

    const tgz = path.join(tmp(), 'out.tgz')
    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(tgz)
      packDir(src).pipe(ws)
      ws.on('finish', () => resolve())
      ws.on('error', reject)
    })
    expect(fs.existsSync(tgz)).toBe(true)

    const dest = tmp()
    await extractTgzTo(tgz, dest)
    expect(fs.readFileSync(path.join(dest, 'journal.db'), 'utf8')).toBe('DBDATA')
    expect(fs.readFileSync(path.join(dest, 'images', 'entries', 'a.png'), 'utf8')).toBe('PNG')
  })
})
