export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event)
  useRepos().rules.reorderGroups(ids)
  return { ok: true }
})
