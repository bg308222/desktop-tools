import { parseDataUrl } from '../../utils/dataUrl'
import type { ImageKind } from '../../../shared/domain'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    entryId?: string
    kind?: ImageKind
    ruleId?: string
    dataUrl: string
  }>(event)
  const { images, rules, store } = useRepos()
  const { ext, buffer } = parseDataUrl(body.dataUrl)
  if (body.ruleId) {
    const w = store.writeRuleImage(body.ruleId, buffer, ext)
    return rules.addRuleImage(body.ruleId, w.filePath)
  }
  if (body.entryId && body.kind) {
    const w = store.writeEntryImage(body.entryId, body.kind, buffer, ext)
    return images.upsert(body.entryId, body.kind, w.filePath, w.width, w.height)
  }
  throw createError({ statusCode: 400, message: 'images.post 參數不足' })
})
