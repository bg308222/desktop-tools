import type { SavedQueryWithMatches } from '../../../shared/query'
import { loadQuerySource, runQuery } from '../../utils/runQuery'

/** 查詢列表，每項附帶目前會查到的各筆（交易日＋市場；client 依全域範圍算筆數）。 */
export default defineEventHandler((): SavedQueryWithMatches[] => {
  const repos = useRepos()
  const src = loadQuerySource(repos)
  return repos.queries.list().map((q) => ({
    ...q,
    matches: runQuery(src, q.conditions).map(({ tradeDate, marketId }) => ({ tradeDate, marketId })),
  }))
})
