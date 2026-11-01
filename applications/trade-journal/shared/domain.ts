export interface Market {
  id: string
  name: string
  sortOrder: number
  archived: boolean
}

export type ImageKind = 'trade' | 'raw' | 'review'

export interface Entry {
  id: string
  marketId: string
  tradeDate: string // YYYY-MM-DD
  /** 實際交易的逐筆 R；空陣列＝0 筆（空手） */
  actual: number[]
  /** 理想交易（復盤後認為該怎麼做）的逐筆 R */
  ideal: number[]
  noteJson: string | null
  createdAt: string
  updatedAt: string
}

export interface ImageRec {
  id: string
  entryId: string
  kind: ImageKind
  filePath: string
  width: number | null
  height: number | null
}

export interface Tag {
  id: string
  name: string
  color: string | null
  body: string | null // 內文/定義（原「規則」內文）
}

export interface TagImage {
  id: string
  tagId: string
  filePath: string
  sortOrder: number
}

export type EntryStatus = 'empty' | 'recorded'

export interface ImagePresence {
  trade: boolean
  raw: boolean
  review: boolean
}

/** entry 加上「三種圖是否存在」——供總覽頁一次算狀態。 */
export interface EntryWithPresence extends Entry {
  images: ImagePresence
}

/** 設定頁「資料狀態」：記錄數、資料指紋、圖片檔完整度 */
export interface DataStatus {
  entryCount: number
  byMarket: { marketId: string; name: string; count: number }[]
  /** SHA-256（hex）：市場、日期、實際/理想 R、圖種與檔名 */
  hash: string
  imageCount: number
  imagePresent: number
  missing: { marketName: string; tradeDate: string; kind: ImageKind }[]
}
