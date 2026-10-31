export default defineEventHandler((event) => {
  const q = getQuery(event)
  const { entries } = useRepos()
  const market = q.market as string | undefined
  const date = q.date as string | undefined
  if (market && date) return entries.get(market, date)
  throw createError({ statusCode: 400, message: 'entries 查詢參數不足' })
})
