import { describe, it, expect } from 'vitest'
import {
  countInRange,
  inRange,
  makeScale,
  rangeToSlider,
  sanitizeRange,
  sliderToRange,
  histogram,
} from '../app/lib/dateRange'

describe('inRange / countInRange', () => {
  it('含頭尾，null 端不限', () => {
    expect(inRange('2026-10-15', { from: '2026-10-15', to: '2026-10-15' })).toBe(true)
    expect(inRange('2026-10-15', { from: '2026-10-16', to: null })).toBe(false)
    expect(inRange('2026-10-15', { from: null, to: '2026-10-14' })).toBe(false)
    expect(inRange('2026-10-15', { from: null, to: null })).toBe(true)
  })

  it('重複日期各算一筆', () => {
    const dates = ['2026-10-01', '2026-10-01', '2026-10-05', '2026-10-09']
    expect(countInRange(dates, { from: '2026-10-01', to: '2026-10-05' })).toBe(3)
  })
})

describe('sanitizeRange', () => {
  it('不合法值改 null、起迄顛倒時對調', () => {
    expect(sanitizeRange(null)).toEqual({ from: null, to: null })
    expect(sanitizeRange({ from: 'x', to: '2026-10-01' })).toEqual({ from: null, to: '2026-10-01' })
    expect(sanitizeRange({ from: '2026-10-09', to: '2026-10-01' })).toEqual({
      from: '2026-10-01',
      to: '2026-10-09',
    })
  })
})

describe('拉桿刻度', () => {
  const s = makeScale(['2026-10-10', '2026-10-01'], '2026-10-26')

  it('從最早記錄到今天', () => {
    expect(s).toEqual({ min: '2026-10-01', max: '2026-10-26', span: 25 })
    expect(makeScale([], '2026-10-26')).toEqual({ min: '2026-10-26', max: '2026-10-26', span: 0 })
    expect(makeScale(['2026-11-02'], '2026-10-26').max).toBe('2026-11-02')
  })

  it('拉到底＝動態端，否則是具體日期', () => {
    expect(sliderToRange([0, 25], s)).toEqual({ from: null, to: null })
    expect(sliderToRange([1, 24], s)).toEqual({ from: '2026-10-02', to: '2026-10-25' })
  })

  it('範圍轉拉桿位置；超出刻度的具體日期夾在兩端', () => {
    expect(rangeToSlider({ from: null, to: null }, s)).toEqual([0, 25])
    expect(rangeToSlider({ from: '2026-10-02', to: '2026-10-25' }, s)).toEqual([1, 24])
    expect(rangeToSlider({ from: '2025-01-01', to: '2027-01-01' }, s)).toEqual([0, 25])
  })

  it('直方圖格寬依跨度調整', () => {
    const dates = ['2026-10-01', '2026-10-07', '2026-10-08', '2026-10-26']
    expect(histogram(dates, s, 4)).toEqual({ days: 7, counts: [2, 1, 0, 1] })
    const daily = histogram(dates, s)
    expect(daily.days).toBe(1)
    expect(daily.counts).toHaveLength(26)
    expect(daily.counts[0]).toBe(1)
    expect(daily.counts[25]).toBe(1)
  })
})
