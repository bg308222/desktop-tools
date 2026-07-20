export default defineEventHandler(async (event) => {
  const { name } = await readBody<{ name: string }>(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: '群組名稱不可為空' })
  return useRepos().rules.createGroup(name.trim())
})
