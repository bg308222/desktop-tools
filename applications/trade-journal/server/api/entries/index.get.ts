export default defineEventHandler((event) => {
  const q = getQuery(event)
  const { entries } = useRepos()
  const market = q.market as string | undefined
  const date = q.date as string | undefined
  const from = q.from as string | undefined
  const to = q.to as string | undefined
  const tags = q.tags as string | undefined
  if (market && date) return entries.get(market, date)
  if (tags != null) return entries.listByTagIds(tags ? tags.split(',') : [])
  if (market && from && to) return entries.listByMarketInRange(market, from, to)
  if (from && to) return entries.listInRange(from, to)
  if (date) return entries.listByDate(date)
  throw createError({ statusCode: 400, message: 'entries 查詢參數不足' })
})
