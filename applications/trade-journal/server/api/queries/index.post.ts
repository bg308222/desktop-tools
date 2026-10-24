import { sanitizeConditions } from '../../../shared/query'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string; conditions?: unknown }>(event)
  const name = body.name?.trim()
  if (!name) throw createError({ statusCode: 400, message: '查詢名稱不可空白' })
  return useRepos().queries.create(name, sanitizeConditions(body.conditions))
})
