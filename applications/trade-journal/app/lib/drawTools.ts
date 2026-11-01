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

/** 比例量測線：橫向範圍固定，六條線各自只能上下拖、不能越過相鄰線 */
export interface RatioDrawing {
  id: number
  tool: 'ratio'
  x1: number
  x2: number
  /** 由上到下排序的六條線 y */
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
  return { id, tool: 'ratio', ...spanX(a, b), ys: parallelLevels(a, b).sort((p, q) => p - q) }
}

/** 由上到下排序後，a、b 兩線固定落在中間兩條（index 2、3） */
export const AB_LINES = [2, 3] as const

/** 拖第 i 條線到 y：限制在相鄰兩線之間（不可越過，可重合） */
export function clampLevel(ys: number[], i: number, y: number): number {
  const lo = i > 0 ? ys[i - 1]! : -Infinity
  const hi = i < ys.length - 1 ? ys[i + 1]! : Infinity
  return Math.min(hi, Math.max(lo, y))
}

/** 各區間（相鄰兩線）高度佔總高（最上到最下）的百分比；總高為 0 時全 0 */
export function segmentPercents(ys: number[]): number[] {
  const total = ys[ys.length - 1]! - ys[0]!
  return ys.slice(1).map((y, i) => (total > 0 ? ((y - ys[i]!) * 100) / total : 0))
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
