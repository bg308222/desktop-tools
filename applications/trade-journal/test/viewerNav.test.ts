import { describe, it, expect } from 'vitest'
import { stepIndex } from '../app/lib/viewerNav'

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
