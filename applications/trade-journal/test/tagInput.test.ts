import { describe, it, expect } from 'vitest'
import { isPickedFromList } from '../app/lib/tagInput'

const KNOWN = ['追多', '假突破', '沒等回撤']

describe('isPickedFromList', () => {
  it('Firefox：datalist 選取的 inputType 為 undefined', () => {
    expect(isPickedFromList(undefined, '追多', KNOWN)).toBe(true)
  })

  it('Chrome：datalist 選取的 inputType 為 insertReplacementText', () => {
    expect(isPickedFromList('insertReplacementText', '追多', KNOWN)).toBe(true)
  })

  it('逐字輸入即使剛好打完整個標籤名也不算選取', () => {
    expect(isPickedFromList('insertText', '追多', KNOWN)).toBe(false)
  })

  it('刪字不算選取', () => {
    expect(isPickedFromList('deleteContentBackward', '追多', KNOWN)).toBe(false)
  })

  it('值不在既有標籤裡 → false（新標籤仍需按 Enter）', () => {
    expect(isPickedFromList(undefined, '全新標籤', KNOWN)).toBe(false)
  })

  it('空值 → false', () => {
    expect(isPickedFromList(undefined, '', KNOWN)).toBe(false)
    expect(isPickedFromList(undefined, '   ', KNOWN)).toBe(false)
  })

  it('前後空白會被忽略', () => {
    expect(isPickedFromList(undefined, '  追多  ', KNOWN)).toBe(true)
  })

  it('沒有任何既有標籤 → false', () => {
    expect(isPickedFromList(undefined, '追多', [])).toBe(false)
  })
})
