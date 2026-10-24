import { sanitizeConditions, type QueryCondition } from '../../../shared/query'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; conditions?: unknown }>(event)
  const patch: { name?: string; conditions?: QueryCondition[] } = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw createError({ statusCode: 400, message: '查詢名稱不可空白' })
    patch.name = name
  }
  if (body.conditions !== undefined) patch.conditions = sanitizeConditions(body.conditions)
  const q = useRepos().queries.update(id, patch)
  if (!q) throw createError({ statusCode: 404, message: '找不到此查詢' })
  return q
})
