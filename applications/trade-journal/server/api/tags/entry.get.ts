export default defineEventHandler((event) => {
  const entry = getQuery(event).entry as string
  if (!entry) throw createError({ statusCode: 400, message: '缺少 entry' })
  return useRepos().tags.getEntryTags(entry)
})
