import { describe, it, expect } from 'vitest'
import { parseDataUrl, extToMime } from '../server/utils/dataUrl'

describe('parseDataUrl', () => {
  it('解析 png dataURL', () => {
    const b64 = Buffer.from('hello').toString('base64')
    const r = parseDataUrl(`data:image/png;base64,${b64}`)
    expect(r.ext).toBe('png')
    expect(r.buffer.toString()).toBe('hello')
  })
  it('jpeg 轉 jpg', () => {
    const b64 = Buffer.from('x').toString('base64')
    expect(parseDataUrl(`data:image/jpeg;base64,${b64}`).ext).toBe('jpg')
  })
  it('非圖片拋錯', () => {
    expect(() => parseDataUrl('data:text/plain;base64,aaa')).toThrow('內容不是圖片')
  })
})

describe('extToMime', () => {
  it('已知副檔名', () => {
    expect(extToMime('jpg')).toBe('image/jpeg')
  })
  it('未知回 octet-stream', () => {
    expect(extToMime('xyz')).toBe('application/octet-stream')
  })
})
