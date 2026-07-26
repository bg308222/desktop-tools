import { join } from 'node:path'
import { openDb } from '../db/connection'
import { createEntryRepo } from '../db/repositories/entryRepo'
import { createImageRepo } from '../db/repositories/imageRepo'
import { createMarketRepo } from '../db/repositories/marketRepo'
import { createTagRepo } from '../db/repositories/tagRepo'
import { createImageStore } from './imageStore'

let cached: ReturnType<typeof build> | null = null

function build() {
  const dataDir = useRuntimeConfig().dataDir as string
  const db = openDb(join(dataDir, 'journal.db'))
  return {
    db,
    dataDir,
    markets: createMarketRepo(db),
    entries: createEntryRepo(db),
    images: createImageRepo(db),
    tags: createTagRepo(db),
    store: createImageStore(dataDir),
  }
}

/** server 端單例：延遲開啟 DB 與建立 repositories。 */
export function useRepos() {
  if (!cached) cached = build()
  return cached
}

/** 重置單例（匯入資料後呼叫）：關閉並清掉快取，下次請求重開讀新資料。 */
export function resetRepos(): void {
  cached?.db.close()
  cached = null
}
