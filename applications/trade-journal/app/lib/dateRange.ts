import dayjs from 'dayjs'

/**
 * 查詢頁的時間範圍（含頭尾）。null 端是「動態」的：from=null 為最早、to=null 為今天（不設上限），
 * 不會隨時間過去而固定在某一天。
 */
export interface DateRange {
  from: string | null
  to: string | null
}

export const FULL_RANGE: DateRange = { from: null, to: null }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = (v: unknown): string | null =>
  typeof v === 'string' && DATE_RE.test(v) ? v : null

/** 整理外來資料（localStorage）；起大於迄時對調。 */
export function sanitizeRange(raw: unknown): DateRange {
  if (!raw || typeof raw !== 'object') return { ...FULL_RANGE }
  const o = raw as Record<string, unknown>
  const from = dateOrNull(o.from)
  const to = dateOrNull(o.to)
  return from && to && from > to ? { from: to, to: from } : { from, to }
}

export function inRange(date: string, r: DateRange): boolean {
  return (!r.from || date >= r.from) && (!r.to || date <= r.to)
}

export function countInRange(dates: string[], r: DateRange): number {
  let n = 0
  for (const d of dates) if (inRange(d, r)) n++
  return n
}

/** 拉桿的刻度：以天為單位，0 ＝ min，span ＝ max。 */
export interface RangeScale {
  min: string
  max: string
  span: number
}

/** 刻度從最早有記錄的那天到「今天與最後一筆較晚者」；沒有記錄時只有今天一格。 */
export function makeScale(recordDates: string[], today: string): RangeScale {
  let min = today
  let max = today
  for (const d of recordDates) {
    if (d < min) min = d
    if (d > max) max = d
  }
  return { min, max, span: dayjs(max).diff(min, 'day') }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
export const dateAt = (s: RangeScale, i: number) =>
  dayjs(s.min).add(clamp(i, 0, s.span), 'day').format('YYYY-MM-DD')
export const indexOf = (s: RangeScale, date: string) =>
  clamp(dayjs(date).diff(s.min, 'day'), 0, s.span)

export function rangeToSlider(r: DateRange, s: RangeScale): [number, number] {
  return [r.from ? indexOf(s, r.from) : 0, r.to ? indexOf(s, r.to) : s.span]
}

/** 拉到底的那端變回動態（最早／今天），其餘落在具體日期。 */
export function sliderToRange([a, b]: [number, number], s: RangeScale): DateRange {
  return {
    from: a <= 0 ? null : dateAt(s, a),
    to: b >= s.span ? null : dateAt(s, b),
  }
}

/** 直方圖：從 scale.min 起每 `days` 天一格計數；格寬依跨度調整，最多約 maxBins 格。 */
export function histogram(
  dates: string[],
  s: RangeScale,
  maxBins = 120,
): { days: number; counts: number[] } {
  const days = Math.max(1, Math.ceil((s.span + 1) / maxBins))
  const counts = new Array<number>(Math.floor(s.span / days) + 1).fill(0)
  for (const d of dates) {
    const i = dayjs(d).diff(s.min, 'day')
    if (i >= 0 && i <= s.span) counts[Math.floor(i / days)]!++
  }
  return { days, counts }
}
