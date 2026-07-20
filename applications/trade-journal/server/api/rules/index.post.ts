export default defineEventHandler(async (event) => {
  const { groupId, name } = await readBody<{ groupId: string; name: string }>(event)
  if (!groupId || !name?.trim()) throw createError({ statusCode: 400, message: '缺少 groupId 或 name' })
  return useRepos().rules.createRule(groupId, name.trim())
})
