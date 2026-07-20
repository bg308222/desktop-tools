export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; archived?: boolean }>(event)
  const m = useRepos().markets
  if (typeof body.name === 'string') m.rename(id, body.name)
  if (typeof body.archived === 'boolean') m.setArchived(id, body.archived)
  return { ok: true }
})
