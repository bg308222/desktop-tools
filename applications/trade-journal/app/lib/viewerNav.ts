/** 循環步進；回傳新索引與是否發生了環繞。 */
export function stepIndex(current: number, len: number, dir: 1 | -1): { index: number; wrapped: boolean } {
  if (len <= 0) return { index: -1, wrapped: false }
  const raw = current + dir
  const wrapped = raw < 0 || raw >= len
  const index = ((raw % len) + len) % len
  return { index, wrapped }
}
