import type { ImageKind } from '../../../shared/domain'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const entry = q.entry as string
  const kind = q.kind as ImageKind
  if (!entry || !kind) throw createError({ statusCode: 400, message: '缺少 entry/kind' })
  const { images, store } = useRepos()
  const rec = images.get(entry, kind)
  if (rec) {
    store.deleteFile(rec.filePath)
    images.remove(entry, kind)
  }
  return { ok: true }
})
