import type { SavedQueryWithDates } from '../../../shared/query'
import { loadQuerySource, runQuery } from '../../utils/runQuery'

/** 查詢列表，每項附帶目前會查到的各筆交易日（client 依時間範圍算筆數）。 */
export default defineEventHandler((): SavedQueryWithDates[] => {
  const repos = useRepos()
  const src = loadQuerySource(repos)
  return repos.queries.list().map((q) => ({ ...q, matchDates: runQuery(src, q.conditions).map((r) => r.tradeDate) }))
})
