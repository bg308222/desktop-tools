export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event)
  useRepos().queries.reorder(ids)
  return { ok: true }
})
