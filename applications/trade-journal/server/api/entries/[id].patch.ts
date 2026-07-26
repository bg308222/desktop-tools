import type { Wlt } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    wlt?: { kind: 'actual' | 'ideal' | 'would'; value: Wlt | null }
    noteJson?: string | null
    noTrade?: boolean
  }>(event)
  const { entries } = useRepos()
  if (body.wlt) entries.setWlt(id, body.wlt.kind, body.wlt.value)
  if (typeof body.noTrade === 'boolean') entries.setNoTrade(id, body.noTrade)
  if ('noteJson' in body) entries.setNote(id, body.noteJson ?? null)
  return { ok: true }
})
