export function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:image\/([\w+]+);base64,(.+)$/s.exec(dataUrl)
  if (!m) throw new Error('內容不是圖片，無法貼上')
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]!
  return { ext, buffer: Buffer.from(m[2]!, 'base64') }
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export function extToMime(ext: string): string {
  return MIME[ext.toLowerCase()] ?? 'application/octet-stream'
}
