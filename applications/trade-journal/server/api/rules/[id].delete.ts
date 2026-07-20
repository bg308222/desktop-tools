export default defineEventHandler((event) => {
  useRepos().rules.deleteRule(getRouterParam(event, 'id')!)
  return { ok: true }
})
