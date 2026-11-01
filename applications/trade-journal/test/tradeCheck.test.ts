import { describe, it, expect } from 'vitest'
import { TRADE_FIELDS, emptyTrade, type Trade } from '../shared/trades'
import { dayWarning, describeWarning, fieldState, tradeState } from '../app/lib/tradeCheck'

const t = (o: Partial<Trade>): Trade => ({ ...emptyTrade(), ...o })
const full = t({ initialTarget: 2, paStop: 0.5, paTarget: 2, realized: 1.5 })
const def = (key: keyof Trade) => TRADE_FIELDS.find((f) => f.key === key)!

describe('fieldState', () => {
  it('初始止盈未填 → error；PA 止損／PA 止盈／實際損益未填 → pending；MFE 未填 → ok', () => {
    const blank = emptyTrade()
    expect(fieldState(blank, def('initialTarget'))).toBe('error')
    expect(fieldState(blank, def('paStop'))).toBe('pending')
    expect(fieldState(blank, def('paTarget'))).toBe('pending')
    expect(fieldState(blank, def('realized'))).toBe('pending')
    expect(fieldState(blank, def('mfe'))).toBe('ok')
  })

  it('填了（含 0）就是 ok', () => {
    expect(fieldState(t({ realized: 0 }), def('realized'))).toBe('ok')
  })
})

describe('tradeState', () => {
  it('缺必填優先於待補', () => {
    expect(tradeState(full)).toBe('ok')
    expect(tradeState(t({ initialTarget: 2 }))).toBe('pending')
    expect(tradeState(t({ paStop: 1 }))).toBe('error')
  })
})

describe('dayWarning', () => {
  it('沒有交易或都填完 → 無警示', () => {
    expect(dayWarning({ actual: [], ideal: [] }).level).toBeNull()
    expect(dayWarning({ actual: [full], ideal: [full] }).level).toBeNull()
  })

  it('任一筆缺必填 → error；否則任一筆待補 → pending；兩邊各自計數', () => {
    const w = dayWarning({ actual: [full, t({ initialTarget: 2 })], ideal: [t({ realized: 1 }), t({ initialTarget: 3 })] })
    expect(w.level).toBe('error')
    expect(w.actual).toEqual({ error: 0, pending: 1 })
    expect(w.ideal).toEqual({ error: 1, pending: 1 })
    expect(describeWarning(w)).toBe('實際 1 筆待補填、理想 1 筆缺初始止盈、理想 1 筆待補填')
    expect(dayWarning({ actual: [], ideal: [t({ initialTarget: 2 })] }).level).toBe('pending')
  })
})
