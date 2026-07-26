import { extToMime } from '../../utils/dataUrl'

export default defineEventHandler((event) => {
  const rel = getQuery(event).path as string
  if (!rel || rel.includes('..')) throw createError({ statusCode: 400, message: '路徑不合法' })
  const buf = useRepos().store.readBuffer(rel)
  if (!buf) throw createError({ statusCode: 404, message: '找不到圖片' })
  const ext = rel.split('.').pop() ?? ''
  setResponseHeader(event, 'Content-Type', extToMime(ext))
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  return new Uint8Array(buf)
})
