import type { ImageKind, ImagePresence, ImageRec } from '../../shared/domain'

export type SlotPaths = Record<ImageKind, string | null>

export function toSlotPaths(recs: ImageRec[]): SlotPaths {
  const map: SlotPaths = { trade: null, raw: null, review: null }
  for (const r of recs) map[r.kind] = r.filePath
  return map
}

export function toPresence(recs: ImageRec[]): ImagePresence {
  return {
    trade: recs.some((r) => r.kind === 'trade'),
    raw: recs.some((r) => r.kind === 'raw'),
    review: recs.some((r) => r.kind === 'review'),
  }
}
