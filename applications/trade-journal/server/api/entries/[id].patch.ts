import { extractRuleIds } from '../../../shared/mention'
import type { Wlt } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    wlt?: { kind: 'actual' | 'ideal'; value: Wlt | null }
    noteJson?: string | null
  }>(event)
  const { entries, rules } = useRepos()
  if (body.wlt) entries.setWlt(id, body.wlt.kind, body.wlt.value)
  if ('noteJson' in body) {
    entries.setNote(id, body.noteJson ?? null)
    rules.setEntryRuleRefs(id, extractRuleIds(body.noteJson ?? null))
  }
  return { ok: true }
})
