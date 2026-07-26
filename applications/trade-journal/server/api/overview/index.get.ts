export default defineEventHandler((event) => {
  const q = getQuery(event)
  const market = q.market as string | undefined
  const from = q.from as string | undefined
  const to = q.to as string | undefined
  if (!market || !from || !to) {
    throw createError({ statusCode: 400, message: 'overview 需要 market / from / to' })
  }
  return useRepos().entries.listPresenceByMarketInRange(market, from, to)
})
