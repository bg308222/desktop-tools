import { describe, it, expect } from 'vitest'
import { deriveStatus, warnings } from '../app/lib/completeness'
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

  describe('勾了空手時交易圖不影響狀態', () => {
    it('空手 + 交易圖 → notrade', () => {
      const e = entry({ noTrade: true, actual: wlt })
      expect(deriveStatus(e, { trade: true, raw: false, review: false })).toBe('notrade')
    })

    it('空手 + 交易圖 + 復盤組 → notrade_reviewed', () => {
      const e = entry({ noTrade: true })
      expect(deriveStatus(e, { trade: true, raw: true, review: true })).toBe('notrade_reviewed')
    })
  })
})

/** 資料完整性提示，獨立於狀態：只提醒，不降級狀態。 */
describe('warnings', () => {
  it('無記錄 → 無提示', () => {
    expect(warnings(null, none)).toEqual([])
  })

  it('什麼都沒填 → 無提示', () => {
    expect(warnings(entry({}), none)).toEqual([])
  })

  it('資料齊全 → 無提示', () => {
    const e = entry({ actual: wlt, ideal: wlt })
    expect(warnings(e, { trade: true, raw: true, review: true })).toEqual([])
  })

  it('W1：復盤圖只有 raw', () => {
    const e = entry({ actual: wlt })
    expect(warnings(e, { trade: true, raw: true, review: false })).toEqual(['復盤圖只上傳了一張'])
  })

  it('W1：復盤圖只有 review', () => {
    const e = entry({ actual: wlt })
    expect(warnings(e, { trade: true, raw: false, review: true })).toEqual(['復盤圖只上傳了一張'])
  })

  it('W2：有交易圖但缺實際 WLT', () => {
    expect(warnings(entry({}), { trade: true, raw: false, review: false })).toEqual([
      '缺實際 WLT',
    ])
  })

  it('W3：復盤組齊但缺理想 WLT', () => {
    const e = entry({ actual: wlt })
    expect(warnings(e, { trade: true, raw: true, review: true })).toEqual([
      '缺理想 WLT，算不出偏差',
    ])
  })

  it('W3：空手已復盤也適用', () => {
    const e = entry({ noTrade: true })
    expect(warnings(e, { trade: false, raw: true, review: true })).toEqual([
      '缺理想 WLT，算不出偏差',
    ])
  })

  it('可同時出現多則，依 W1/W2/W3 順序', () => {
    expect(warnings(entry({}), { trade: true, raw: true, review: false })).toEqual([
      '復盤圖只上傳了一張',
      '缺實際 WLT',
    ])
  })

  it('空手日有交易圖也不提示缺實際 WLT', () => {
    const e = entry({ noTrade: true })
    expect(warnings(e, { trade: true, raw: false, review: false })).toEqual([])
  })

  it('無交易圖時不提示缺實際 WLT', () => {
    const e = entry({ noTrade: true })
    expect(warnings(e, none)).toEqual([])
  })
})
