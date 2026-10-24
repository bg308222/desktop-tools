import { sanitizeConditions } from '../../../shared/query'
import { loadQuerySource, runQuery } from '../../utils/runQuery'

/** 跑一組條件（不必先存）：查詢頁的結果與編輯時的即時預覽都走這裡。 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ conditions?: unknown }>(event)
  return runQuery(loadQuerySource(useRepos()), sanitizeConditions(body.conditions))
})
