import { describe, it, expect } from 'vitest'
import {
  clampLevel,
  cloneDrawings,
  createHistory,
  isValidSpan,
  parallelLevels,
  segmentPercents,
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

  it('拖線不可越過相鄰線（可重合）；最外兩條只限一側', () => {
    const ys = [40, 60, 80, 100, 120, 140]
    expect(clampLevel(ys, 2, 50)).toBe(60)
    expect(clampLevel(ys, 2, 105)).toBe(100)
    expect(clampLevel(ys, 2, 90)).toBe(90)
    expect(clampLevel(ys, 0, -500)).toBe(-500)
    expect(clampLevel(ys, 0, 70)).toBe(60)
    expect(clampLevel(ys, 5, 999)).toBe(999)
  })

  it('區間百分比＝區間高／總高 × 100', () => {
    expect(segmentPercents([0, 20, 40, 60, 80, 100])).toEqual([20, 20, 20, 20, 20])
    expect(segmentPercents([0, 10, 10, 50, 90, 200])).toEqual([5, 0, 20, 20, 55])
    expect(segmentPercents([5, 5, 5, 5, 5, 5])).toEqual([0, 0, 0, 0, 0])
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
