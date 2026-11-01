import type { TradeKind } from '../../../shared/trades'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{
    trades?: { kind: TradeKind; value: unknown }
    noteJson?: string | null
  }>(event)
  const { entries } = useRepos()
  if (body.trades) {
    if (body.trades.kind !== 'actual' && body.trades.kind !== 'ideal')
      throw createError({ statusCode: 400, message: 'trades.kind 需為 actual 或 ideal' })
    entries.setTrades(id, body.trades.kind, body.trades.value)
  }
  if ('noteJson' in body) entries.setNote(id, body.noteJson ?? null)
  return { ok: true }
})
