import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../renderer/lib/completeness'
import type { Entry } from '../shared/domain'

function entry(partial: Partial<Entry>): Entry {
  return {
    id: 'e',
    marketId: 'm',
    tradeDate: '2026-07-14',
    actual: null,
    ideal: null,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const none = { trade: false, raw: false, review: false }

describe('deriveStatus', () => {
  it('null → empty', () => {
    expect(deriveStatus(null, none)).toBe('empty')
  })

  it('缺交易圖或實際 WLT → empty', () => {
    expect(deriveStatus(entry({ actual: { w: 1, l: 0, t: 0 } }), none)).toBe('empty')
    expect(deriveStatus(entry({}), { trade: true, raw: false, review: false })).toBe('empty')
  })

  it('交易圖 + 實際 WLT，但復盤未齊 → recorded', () => {
    const e = entry({ actual: { w: 2, l: 1, t: 0 } })
    expect(deriveStatus(e, { trade: true, raw: false, review: false })).toBe('recorded')
  })

  it('三圖 + 實際 + 理想 → reviewed', () => {
    const e = entry({ actual: { w: 2, l: 1, t: 0 }, ideal: { w: 3, l: 0, t: 0 } })
    expect(deriveStatus(e, { trade: true, raw: true, review: true })).toBe('reviewed')
  })

  it('三圖齊但缺理想 WLT → recorded', () => {
    const e = entry({ actual: { w: 2, l: 1, t: 0 } })
    expect(deriveStatus(e, { trade: true, raw: true, review: true })).toBe('recorded')
  })
})
