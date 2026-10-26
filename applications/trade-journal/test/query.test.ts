import { describe, it, expect } from 'vitest'
import { matchConditions, sanitizeConditions, type QueryCandidate } from '../shared/query'

const cand = (partial: Partial<QueryCandidate> = {}): QueryCandidate => ({
  marketId: 'm1',
  tradeDate: '2026-10-15',
  tagIds: new Set(['a', 'b']),
  ...partial,
})

describe('matchConditions', () => {
  it('沒有條件 → 全部符合', () => {
    expect(matchConditions(cand(), [])).toBe(true)
  })

  it('標籤 all / any / none', () => {
    const c = cand()
    expect(matchConditions(c, [{ kind: 'tag', mode: 'all', tagIds: ['a', 'b'] }])).toBe(true)
    expect(matchConditions(c, [{ kind: 'tag', mode: 'all', tagIds: ['a', 'x'] }])).toBe(false)
    expect(matchConditions(c, [{ kind: 'tag', mode: 'any', tagIds: ['x', 'b'] }])).toBe(true)
    expect(matchConditions(c, [{ kind: 'tag', mode: 'any', tagIds: ['x', 'y'] }])).toBe(false)
    expect(matchConditions(c, [{ kind: 'tag', mode: 'none', tagIds: ['x'] }])).toBe(true)
    expect(matchConditions(c, [{ kind: 'tag', mode: 'none', tagIds: ['x', 'a'] }])).toBe(false)
  })

  it('市場', () => {
    expect(matchConditions(cand(), [{ kind: 'market', marketIds: ['m2', 'm1'] }])).toBe(true)
    expect(matchConditions(cand(), [{ kind: 'market', marketIds: ['m2'] }])).toBe(false)
  })

  it('還沒選值的條件視為不限', () => {
    expect(
      matchConditions(cand(), [
        { kind: 'tag', mode: 'all', tagIds: [] },
        { kind: 'market', marketIds: [] },
      ]),
    ).toBe(true)
  })

  it('多個條件之間為 AND（同類條件也可疊）', () => {
    const conds = [
      { kind: 'tag', mode: 'any', tagIds: ['a'] },
      { kind: 'tag', mode: 'none', tagIds: ['b'] },
    ] as const
    expect(matchConditions(cand(), [...conds])).toBe(false)
    expect(matchConditions(cand({ tagIds: new Set(['a']) }), [...conds])).toBe(true)
  })
})

describe('sanitizeConditions', () => {
  it('丟掉不認得的條件（含已淘汰的日期條件）、修正不合法的值', () => {
    expect(
      sanitizeConditions([
        { kind: 'tag', mode: 'weird', tagIds: ['a', 'a', 3] },
        { kind: 'date', from: '2026-10-01', to: 'tomorrow' },
        { kind: 'status', statuses: ['reviewed'] },
        { kind: 'would' },
        null,
      ]),
    ).toEqual([{ kind: 'tag', mode: 'all', tagIds: ['a'] }])
    expect(sanitizeConditions('x')).toEqual([])
  })
})
