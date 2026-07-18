import { describe, it, expect } from 'vitest'
import { extractRuleIds } from '../renderer/lib/mention'

describe('extractRuleIds', () => {
  it('null / 無效 JSON → []', () => {
    expect(extractRuleIds(null)).toEqual([])
    expect(extractRuleIds('not json')).toEqual([])
  })

  it('萃取巢狀 mention 節點的 id 並去重', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '依 ' },
            { type: 'mention', attrs: { id: 'r1', label: '只在區間邊緣進場' } },
            { type: 'text', text: ' 與 ' },
            { type: 'mention', attrs: { id: 'r2', label: '獲利先出一半' } },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'mention', attrs: { id: 'r1' } }],
        },
      ],
    }
    expect(extractRuleIds(JSON.stringify(doc)).sort()).toEqual(['r1', 'r2'])
  })

  it('無 mention → []', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    expect(extractRuleIds(JSON.stringify(doc))).toEqual([])
  })
})
