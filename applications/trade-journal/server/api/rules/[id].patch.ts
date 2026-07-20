export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; bodyJson?: string | null; groupId?: string }>(event)
  const { rules } = useRepos()
  if (body.groupId) rules.moveRule(id, body.groupId)
  if ('name' in body || 'bodyJson' in body) {
    rules.updateRule(id, { name: body.name, bodyJson: body.bodyJson })
  }
  return { ok: true }
})
