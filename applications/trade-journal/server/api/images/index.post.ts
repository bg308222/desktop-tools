import { parseDataUrl } from '../../utils/dataUrl'
import type { ImageKind } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    entryId?: string
    kind?: ImageKind
    tagId?: string
    dataUrl: string
  }>(event)
  const { images, tags, store } = useRepos()
  const { ext, buffer } = parseDataUrl(body.dataUrl)
  if (body.tagId) {
    const w = store.writeTagImage(body.tagId, buffer, ext)
    return tags.addImage(body.tagId, w.filePath)
  }
  if (body.entryId && body.kind) {
    const w = store.writeEntryImage(body.entryId, body.kind, buffer, ext)
    return images.upsert(body.entryId, body.kind, w.filePath, w.width, w.height)
  }
  throw createError({ statusCode: 400, message: 'images.post 參數不足' })
})
