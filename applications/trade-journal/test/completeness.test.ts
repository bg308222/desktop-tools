import { describe, it, expect } from 'vitest'
import { deriveStatus, warnings } from '../app/lib/completeness'

const img = (raw: boolean, review: boolean, trade = false) => ({ trade, raw, review })

/** 狀態只看兩件事：實際 R 有沒有筆數、原圖＋復盤圖是否齊。交易圖不參與。 */
describe('deriveStatus', () => {
  it('無記錄 → empty', () => {
    expect(deriveStatus(null, img(false, false))).toBe('empty')
    expect(deriveStatus(null, img(true, true))).toBe('notrade_reviewed')
  })

  it('有實際交易：復盤齊 → reviewed，否則 recorded', () => {
    expect(deriveStatus({ actual: [2] }, img(true, true))).toBe('reviewed')
    expect(deriveStatus({ actual: [2] }, img(true, false))).toBe('recorded')
    expect(deriveStatus({ actual: [-1, 2] }, img(false, false))).toBe('recorded')
  })

  it('實際 0 筆：復盤齊 → notrade_reviewed，否則 empty', () => {
    expect(deriveStatus({ actual: [] }, img(true, true))).toBe('notrade_reviewed')
    expect(deriveStatus({ actual: [] }, img(false, false))).toBe('empty')
    expect(deriveStatus({ actual: [] }, img(false, true))).toBe('empty')
  })

  it('交易圖不影響狀態', () => {
    expect(deriveStatus({ actual: [] }, img(false, false, true))).toBe('empty')
    expect(deriveStatus({ actual: [] }, img(true, true, true))).toBe('notrade_reviewed')
    expect(deriveStatus({ actual: [1] }, img(false, false, true))).toBe('recorded')
  })
})

describe('warnings', () => {
  it('復盤圖只傳一張才提示', () => {
    expect(warnings(img(true, false))).toEqual(['復盤圖只上傳了一張'])
    expect(warnings(img(false, true))).toEqual(['復盤圖只上傳了一張'])
    expect(warnings(img(true, true))).toEqual([])
    expect(warnings(img(false, false, true))).toEqual([])
  })
})
