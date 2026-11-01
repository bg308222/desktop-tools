import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../app/lib/completeness'

const img = (trade: boolean, raw: boolean, review: boolean) => ({ trade, raw, review })

describe('deriveStatus', () => {
  it('沒有 entry → 待記錄', () => {
    expect(deriveStatus(null, img(false, false, false))).toBe('empty')
    expect(deriveStatus(null, img(true, true, true))).toBe('empty')
  })

  it('有 entry 但沒有任何圖 → 待記錄', () => {
    expect(deriveStatus({}, img(false, false, false))).toBe('empty')
  })

  it('有 entry 且任一張圖 → 已記錄', () => {
    expect(deriveStatus({}, img(true, false, false))).toBe('recorded')
    expect(deriveStatus({}, img(false, true, false))).toBe('recorded')
    expect(deriveStatus({}, img(false, false, true))).toBe('recorded')
    expect(deriveStatus({}, img(true, true, true))).toBe('recorded')
  })
})
