/**
 * 標籤的顯示樣式：有顏色時用標籤色，沒有時交給呼叫端套預設（primary）樣式。
 *
 * - subtle：淡底（標籤色混透明）＋ 標籤色外框，文字維持一般字色，淺色／深色模式都讀得到。
 * - solid：實色底，字色依底色亮度選黑或白。
 */
export type TagChipStyle = Record<string, string>

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

/** 只接受 #rgb / #rrggbb；其他（null、空字串、亂填）視為沒有顏色。 */
export function normalizeTagColor(color: string | null | undefined): string | null {
  if (!color) return null
  const c = color.trim()
  return HEX.test(c) ? c.toLowerCase() : null
}

function toRgb(hex: string): [number, number, number] {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join('')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

/** WCAG 相對亮度（0～1）。 */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * 實色底上該用的字色：夠亮（黃、橘、綠）用黑字，其餘用白字。
 * 不用純 WCAG 對比取高者——那會讓藍、紅、紫這類中亮度飽和色配黑字，看起來很髒。
 */
export function textOn(hex: string): '#000' | '#fff' {
  return luminance(hex) > 0.4 ? '#000' : '#fff'
}

/** 回傳 inline style；沒有（合法）顏色時回 null，由呼叫端用預設樣式。 */
export function tagChipStyle(
  color: string | null | undefined,
  variant: 'subtle' | 'solid' = 'subtle',
): TagChipStyle | null {
  const c = normalizeTagColor(color)
  if (!c) return null
  if (variant === 'solid') return { background: c, borderColor: c, color: textOn(c) }
  return {
    background: `color-mix(in srgb, ${c} 18%, transparent)`,
    borderColor: `color-mix(in srgb, ${c} 60%, transparent)`,
    color: 'var(--ui-text)',
  }
}
