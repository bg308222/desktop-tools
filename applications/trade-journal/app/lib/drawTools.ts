/**
 * 繪圖模式的量測工具幾何（純函式，螢幕像素座標，y 向下）。
 * 繪圖不存任何地方：退出繪圖模式即清空。
 */
export interface Pt {
  x: number
  y: number
}

export type DrawTool = 'parallel' | 'ratio'

/** 等距平行線：a、b 兩點可拖，六條線隨之重算 */
export interface ParallelDrawing {
  id: number
  tool: 'parallel'
  a: Pt
  b: Pt
}

/** 比例量測線：橫向範圍固定，六條線各自只能上下拖，可越過其他線 */
export interface RatioDrawing {
  id: number
  tool: 'ratio'
  x1: number
  x2: number
  /** 六條線的 y（畫定時由上到下；拖動後可交錯，index 即線的身分） */
  ys: number[]
}

export type Drawing = ParallelDrawing | RatioDrawing

/** 六條線相對 a 的倍數：a、b 兩線，再往外各延伸 1、2 倍 y 差 */
export const PARALLEL_KS = [-2, -1, 0, 1, 2, 3] as const

/** 兩點太近（任一軸 < 3px）不成立，避免畫出看不見的線 */
export const MIN_SPAN = 3
export const isValidSpan = (a: Pt, b: Pt) =>
  Math.abs(b.x - a.x) >= MIN_SPAN && Math.abs(b.y - a.y) >= MIN_SPAN

/** 橫向範圍：a、b 的 x 差 */
export const spanX = (a: Pt, b: Pt) => ({ x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) })

/** 等距平行線六條線的 y（依 k 順序，未排序） */
export const parallelLevels = (a: Pt, b: Pt) => PARALLEL_KS.map((k) => a.y + k * (b.y - a.y))

/** a、b 定下後轉成比例量測線（六條線由上到下排序） */
export function toRatio(id: number, a: Pt, b: Pt): RatioDrawing {
  const ys = parallelLevels(a, b).sort((p, q) => p - q)
  return { id, tool: 'ratio', ...spanX(a, b), ys }
}

/** a、b 兩線的 index（畫定時由上到下排序，兩線落在中間兩條） */
export const AB_LINES = [2, 3] as const

export interface Segment {
  top: number
  bottom: number
  /** 段高是 a、b 兩線目前高的幾倍；a、b 重合時無法比，為 null */
  ratio: number | null
}

/**
 * 依目前位置由上到下排序，相鄰兩線為一段，段高除以 a、b 兩線目前的高。
 * 線可交錯：把其他線拉進 a、b 之間，就能量出相對 a、b（＝1）的距離。
 */
export function segmentRatios(ys: number[]): Segment[] {
  const unit = Math.abs(ys[AB_LINES[1]]! - ys[AB_LINES[0]]!)
  const sorted = [...ys].sort((p, q) => p - q)
  return sorted.slice(1).map((bottom, i) => {
    const top = sorted[i]!
    return { top, bottom, ratio: unit > 0 ? (bottom - top) / unit : null }
  })
}

/** 復原／重做：存整份繪圖的快照 */
export function createHistory<T>(clone: (v: T) => T) {
  const past: T[] = []
  const future: T[] = []
  return {
    /** 變動「前」呼叫，記下變動前的狀態 */
    record(before: T) {
      past.push(clone(before))
      future.length = 0
    },
    undo(current: T): T | null {
      const prev = past.pop()
      if (prev === undefined) return null
      future.push(clone(current))
      return prev
    },
    redo(current: T): T | null {
      const next = future.pop()
      if (next === undefined) return null
      past.push(clone(current))
      return next
    },
    clear() {
      past.length = 0
      future.length = 0
    },
  }
}

export const cloneDrawings = (ds: Drawing[]): Drawing[] =>
  ds.map((d) => (d.tool === 'parallel' ? { ...d, a: { ...d.a }, b: { ...d.b } } : { ...d, ys: [...d.ys] }))
