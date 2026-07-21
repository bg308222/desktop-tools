export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ name?: string; color?: string | null; body?: string | null }>(event)
  const { tags } = useRepos()
  if (typeof body.name === 'string') tags.rename(id, body.name)
  if ('color' in body) tags.setColor(id, body.color ?? null)
  if ('body' in body) tags.setBody(id, body.body ?? null)
  return { ok: true }
})
