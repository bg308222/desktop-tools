export default defineEventHandler((event) =>
  useRepos().rules.entriesReferencing(getRouterParam(event, 'id')!),
)
