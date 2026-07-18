import { describe, it, expect } from 'vitest'
import { datesForMarket, marketsForDate, stepIndex } from '../renderer/lib/viewerNav'
import type { Entry } from '../shared/domain'

function e(marketId: string, tradeDate: string): Entry {
  return {
    id: `${marketId}-${tradeDate}`,
    marketId,
    tradeDate,
    actual: null,
    ideal: null,
    noteJson: null,
    createdAt: '',
    updatedAt: '',
  }
}

const WEEK = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']

describe('datesForMarket', () => {
  it('過濾市場、限縮當週、排序、跳過無資料', () => {
    const entries = [e('m1', '2026-07-16'), e('m1', '2026-07-14'), e('m2', '2026-07-15'), e('m1', '2026-07-20')]
    expect(datesForMarket(entries, 'm1', WEEK)).toEqual(['2026-07-14', '2026-07-16'])
  })
})

describe('marketsForDate', () => {
  it('依 marketOrder 回傳當天有資料的市場', () => {
    const entries = [e('m2', '2026-07-14'), e('m1', '2026-07-14'), e('m3', '2026-07-15')]
    expect(marketsForDate(entries, '2026-07-14', ['m1', 'm2', 'm3'])).toEqual(['m1', 'm2'])
  })
})

describe('stepIndex', () => {
  it('前進不環繞', () => {
    expect(stepIndex(0, 3, 1)).toEqual({ index: 1, wrapped: false })
  })
  it('尾端前進環繞到頭', () => {
    expect(stepIndex(2, 3, 1)).toEqual({ index: 0, wrapped: true })
  })
  it('開頭後退環繞到尾', () => {
    expect(stepIndex(0, 3, -1)).toEqual({ index: 2, wrapped: true })
  })
  it('空集合回 -1', () => {
    expect(stepIndex(0, 0, 1)).toEqual({ index: -1, wrapped: false })
  })
})
