export default defineEventHandler((event) =>
  useRepos().rules.listRuleImages(getRouterParam(event, 'id')!),
)
