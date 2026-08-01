import { describe, it, expect } from 'vitest'
import { deriveStatus } from '../app/lib/completeness'
import type { Entry } from '../shared/domain'

function entry(partial: Partial<Entry>): Entry {
  return {
    id: 'e',
    marketId: 'm',
    tradeDate: '2026-07-14',
    actual: null,
    ideal: null,
    would: null,
    noTrade: false,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
    ...partial,
  }
}

const none = { trade: false, raw: false, review: false }
const wlt = { w: 1, l: 0, t: 0 }

/**
 * 狀態只看兩件事：交易圖是否存在、復盤組（raw+review 皆有）是否齊。
 * 空手旗標只在兩者皆無時用來分辨「主動空手」與「還沒記」。
 * actual/ideal/would 一律不參與判定（缺漏由 warning 呈現）。
 */
describe('deriveStatus', () => {
  it('無記錄 → empty', () => {
    expect(deriveStatus(null, none)).toBe('empty')
  })

  it('交易圖 + 復盤組 → reviewed', () => {
    const e = entry({ actual: wlt, ideal: wlt })
    expect(deriveStatus(e, { trade: true, raw: true, review: true })).toBe('reviewed')
  })

  it('交易圖 + 無復盤組 → recorded', () => {
    const e = entry({ actual: wlt })
    expect(deriveStatus(e, { trade: true, raw: false, review: false })).toBe('recorded')
  })

  it('無交易圖 + 復盤組 → notrade_reviewed（未勾空手也算）', () => {
    const e = entry({ ideal: wlt })
    expect(deriveStatus(e, { trade: false, raw: true, review: true })).toBe('notrade_reviewed')
  })

  it('無交易圖 + 無復盤組 + 勾空手 → notrade', () => {
    expect(deriveStatus(entry({ noTrade: true }), none)).toBe('notrade')
  })

  it('無交易圖 + 無復盤組 + 未勾空手 → empty', () => {
    expect(deriveStatus(entry({}), none)).toBe('empty')
  })

  describe('復盤組需 raw 與 review 皆有，只有一張視同未復盤', () => {
    it('交易圖 + 只有 raw → recorded', () => {
      expect(deriveStatus(entry({}), { trade: true, raw: true, review: false })).toBe('recorded')
    })

    it('交易圖 + 只有 review → recorded', () => {
      expect(deriveStatus(entry({}), { trade: true, raw: false, review: true })).toBe('recorded')
    })

    it('空手 + 只有 raw → notrade', () => {
      const e = entry({ noTrade: true })
      expect(deriveStatus(e, { trade: false, raw: true, review: false })).toBe('notrade')
    })

    it('未勾空手 + 只有 review → empty', () => {
      expect(deriveStatus(entry({}), { trade: false, raw: false, review: true })).toBe('empty')
    })
  })

  describe('WLT 不影響狀態', () => {
    it('交易圖 + 復盤組，缺 ideal 仍是 reviewed', () => {
      const e = entry({ actual: wlt })
      expect(deriveStatus(e, { trade: true, raw: true, review: true })).toBe('reviewed')
    })

    it('交易圖，缺 actual 仍是 recorded', () => {
      expect(deriveStatus(entry({}), { trade: true, raw: false, review: false })).toBe('recorded')
    })

    it('空手 + 復盤組，缺 ideal 仍是 notrade_reviewed', () => {
      const e = entry({ noTrade: true })
      expect(deriveStatus(e, { trade: false, raw: true, review: true })).toBe('notrade_reviewed')
    })

    it('有 actual 但無任何圖，未勾空手仍是 empty', () => {
      expect(deriveStatus(entry({ actual: wlt }), none)).toBe('empty')
    })
  })

  it('勾了空手但有交易圖 → 以圖片為準（recorded）', () => {
    const e = entry({ noTrade: true, actual: wlt })
    expect(deriveStatus(e, { trade: true, raw: false, review: false })).toBe('recorded')
  })
})
