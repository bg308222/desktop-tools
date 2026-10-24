export default defineEventHandler((event) => {
  useRepos().queries.remove(getRouterParam(event, 'id')!)
  return { ok: true }
})
