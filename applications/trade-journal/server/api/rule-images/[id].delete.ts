export default defineEventHandler((event) => {
  useRepos().rules.removeRuleImage(getRouterParam(event, 'id')!)
  return { ok: true }
})
