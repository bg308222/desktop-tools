import { describe, it, expect } from 'vitest'
import { normalizeTagColor, tagChipStyle, textOn } from '../app/lib/tagColor'

describe('normalizeTagColor', () => {
  it('合法 hex 轉小寫', () => {
    expect(normalizeTagColor('#EF4444')).toBe('#ef4444')
    expect(normalizeTagColor('#abc')).toBe('#abc')
  })
  it('null／空字串／非 hex → null', () => {
    expect(normalizeTagColor(null)).toBeNull()
    expect(normalizeTagColor('')).toBeNull()
    expect(normalizeTagColor('red')).toBeNull()
    expect(normalizeTagColor('#12345')).toBeNull()
  })
})

describe('textOn', () => {
  it('亮底用黑字、暗底用白字', () => {
    expect(textOn('#eab308')).toBe('#000')
    expect(textOn('#ffffff')).toBe('#000')
    expect(textOn('#22c55e')).toBe('#000')
    expect(textOn('#3b82f6')).toBe('#fff')
    expect(textOn('#ef4444')).toBe('#fff')
    expect(textOn('#000000')).toBe('#fff')
    expect(textOn('#a855f7')).toBe('#fff')
  })
})

describe('tagChipStyle', () => {
  it('沒有顏色 → null（呼叫端用預設樣式）', () => {
    expect(tagChipStyle(null)).toBeNull()
    expect(tagChipStyle('nope', 'solid')).toBeNull()
  })
  it('subtle：淡底＋標籤色外框', () => {
    const s = tagChipStyle('#ef4444')!
    expect(s.background).toContain('#ef4444')
    expect(s.background).toContain('18%')
    expect(s.borderColor).toContain('#ef4444')
  })
  it('solid：實色底＋對比字色', () => {
    expect(tagChipStyle('#000000', 'solid')).toEqual({ background: '#000000', borderColor: '#000000', color: '#fff' })
  })
})
