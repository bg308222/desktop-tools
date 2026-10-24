import { sanitizeConditions } from '../../../shared/query'
import { runQuery } from '../../utils/runQuery'

/** 跑一組條件（不必先存）：查詢頁的結果與編輯時的即時預覽都走這裡。 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ conditions?: unknown }>(event)
  const { entries, tags, markets } = useRepos()
  return runQuery(
    {
      entries: entries.listAll(),
      entryTags: tags.entryTagMap(),
      tagIds: new Set(tags.list().map((t) => t.id)),
      marketOrder: markets.list().map((m) => m.id),
    },
    sanitizeConditions(body.conditions),
  )
})
