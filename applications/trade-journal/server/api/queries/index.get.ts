import type { SavedQueryWithCount } from '../../../shared/query'
import { loadQuerySource, runQuery } from '../../utils/runQuery'

/** 查詢列表，每項附帶目前會查到的筆數。 */
export default defineEventHandler((): SavedQueryWithCount[] => {
  const repos = useRepos()
  const src = loadQuerySource(repos)
  return repos.queries.list().map((q) => ({ ...q, count: runQuery(src, q.conditions).length }))
})
