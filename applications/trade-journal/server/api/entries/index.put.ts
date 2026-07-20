import type { EntryUpsert } from '../../db/repositories/entryRepo'

export default defineEventHandler(async (event) => {
  const body = await readBody<EntryUpsert>(event)
  if (!body.marketId || !body.tradeDate)
    throw createError({ statusCode: 400, message: '缺少 marketId 或 tradeDate' })
  return useRepos().entries.upsert(body)
})
