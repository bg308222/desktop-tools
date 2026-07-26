export default defineEventHandler(async (event) => {
  const { entryId, tagIds } = await readBody<{ entryId: string; tagIds: string[] }>(event)
  useRepos().tags.setEntryTags(entryId, tagIds)
  return { ok: true }
})
