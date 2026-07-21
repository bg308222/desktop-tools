export default defineEventHandler((event) => {
  useRepos().tags.removeImage(getRouterParam(event, 'id')!)
  return { ok: true }
})
