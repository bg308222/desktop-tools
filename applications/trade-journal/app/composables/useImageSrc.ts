/** 相對圖片路徑 → 後端檔案輸出 URL（供 <img :src>）。 */
export function useImageSrc(rel: string | null | undefined): string {
  return rel ? `/api/images/file?path=${encodeURIComponent(rel)}` : ''
}
