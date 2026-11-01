import { describe, it, expect } from 'vitest'
import {
  cloneDrawings,
  createHistory,
  isValidSpan,
  parallelLevels,
  segmentRatios,
  spanX,
  toRatio,
  type Drawing,
} from '../app/lib/drawTools'

describe('等距平行線', () => {
  it('六條線：a、b 再往外各延伸 1、2 倍 y 差，間距相等', () => {
    expect(parallelLevels({ x: 0, y: 100 }, { x: 50, y: 120 })).toEqual([60, 80, 100, 120, 140, 160])
    // b 在 a 上方也成立
    expect(parallelLevels({ x: 0, y: 100 }, { x: 50, y: 80 })).toEqual([140, 120, 100, 80, 60, 40])
  })

  it('橫向範圍為 a、b 的 x 差（不分左右）', () => {
    expect(spanX({ x: 80, y: 0 }, { x: 20, y: 0 })).toEqual({ x1: 20, x2: 80 })
  })

  it('任一軸差 < 3px 不成立', () => {
    expect(isValidSpan({ x: 0, y: 0 }, { x: 2, y: 50 })).toBe(false)
    expect(isValidSpan({ x: 0, y: 0 }, { x: 50, y: -2 })).toBe(false)
    expect(isValidSpan({ x: 0, y: 0 }, { x: 3, y: -3 })).toBe(true)
  })
})

describe('比例量測線', () => {
  it('轉換後由上到下排序，a、b 兩線在中間', () => {
    const r = toRatio(1, { x: 50, y: 100 }, { x: 10, y: 80 })
    expect(r).toMatchObject({ x1: 10, x2: 50, ys: [40, 60, 80, 100, 120, 140] })
  })

  it('區間比例＝區間高／a、b 兩線目前的高（a、b 那段恆為 1）', () => {
    const ratios = (ys: number[]) => segmentRatios(ys).map((s) => s.ratio)
    expect(ratios([0, 20, 40, 60, 80, 100])).toEqual([1, 1, 1, 1, 1])
    // 拖動 a、b 線後，基準跟著變
    expect(ratios([0, 10, 20, 60, 90, 200])).toEqual([0.25, 0.25, 1, 0.75, 2.75])
    expect(ratios([0, 10, 30, 30, 90, 200])).toEqual([null, null, null, null, null])
  })

  it('線可越過其他線：依目前位置重新分段，基準仍是 a、b 兩線', () => {
    // 最下面那條（index 5）拉進 a(40)、b(60) 之間的 52
    expect(segmentRatios([0, 20, 40, 60, 80, 52])).toEqual([
      { top: 0, bottom: 20, ratio: 1 },
      { top: 20, bottom: 40, ratio: 1 },
      { top: 40, bottom: 52, ratio: 0.6 },
      { top: 52, bottom: 60, ratio: 0.4 },
      { top: 60, bottom: 80, ratio: 1 },
    ])
    // a、b 本身交錯，高仍取絕對值
    expect(segmentRatios([0, 20, 70, 50, 80, 100]).map((s) => s.ratio)).toEqual([1, 1.5, 1, 0.5, 1])
  })
})

describe('復原／重做', () => {
  const one: Drawing[] = [{ id: 1, tool: 'parallel', a: { x: 0, y: 0 }, b: { x: 9, y: 9 } }]

  it('undo 回到變動前、redo 回到變動後；新變動清掉 redo', () => {
    const h = createHistory(cloneDrawings)
    h.record([])
    expect(h.undo(one)).toEqual([])
    expect(h.redo([])).toEqual(one)
    expect(h.redo(one)).toBeNull()

    h.record(one)
    h.undo([])
    h.record(one) // 新變動
    expect(h.redo([])).toBeNull()
  })

  it('沒有歷史時 undo 回 null', () => {
    expect(createHistory(cloneDrawings).undo(one)).toBeNull()
  })

  it('快照是深拷貝，之後改動不影響歷史', () => {
    const h = createHistory(cloneDrawings)
    const cur = cloneDrawings(one)
    h.record(cur)
    ;(cur[0] as { a: { x: number } }).a.x = 999
    expect(h.undo(cur)).toEqual(one)
  })
})
