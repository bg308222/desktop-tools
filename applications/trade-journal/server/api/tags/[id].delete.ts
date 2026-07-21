export default defineEventHandler((event) => {
  useRepos().tags.remove(getRouterParam(event, 'id')!)
  return { ok: true }
})
