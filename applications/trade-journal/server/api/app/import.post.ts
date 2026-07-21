import fs from 'node:fs'
import os from 'node:os'
import { join, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { extractTgzTo } from '../../utils/archive'
import { resetRepos } from '../../utils/repos'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const file = form?.find((f) => f.filename)
  if (!file) throw createError({ statusCode: 400, message: '沒有收到檔案' })

  const { dataDir } = useRepos()
  const backup = join(dirname(dataDir), `data-bak-${stamp()}`)

  // 1) 自動先備份現有資料
  fs.cpSync(dataDir, backup, { recursive: true })
  // 2) 關閉 DB 連線（才能覆蓋檔案）
  resetRepos()
  // 3) 寫入上傳檔到暫存並解壓覆蓋
  const tmp = join(os.tmpdir(), `tj-import-${randomUUID()}.tgz`)
  fs.writeFileSync(tmp, file.data)
  fs.rmSync(dataDir, { recursive: true, force: true })
  fs.mkdirSync(dataDir, { recursive: true })
  await extractTgzTo(tmp, dataDir)
  fs.rmSync(tmp, { force: true })

  return { ok: true, backup }
})
