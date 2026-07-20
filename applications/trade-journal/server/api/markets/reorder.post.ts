export default defineEventHandler(async (event) => {
  const { ids } = await readBody<{ ids: string[] }>(event)
  useRepos().markets.reorder(ids)
  return { ok: true }
})
