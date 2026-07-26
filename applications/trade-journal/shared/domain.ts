export interface Market {
  id: string
  name: string
  sortOrder: number
  archived: boolean
}

export interface Wlt {
  w: number
  l: number
  t: number
}

export type ImageKind = 'trade' | 'raw' | 'review'

export interface Entry {
  id: string
  marketId: string
  tradeDate: string // YYYY-MM-DD
  actual: Wlt | null
  ideal: Wlt | null
  would: Wlt | null // 會做（未執行）：本來會做、但因臨時有事沒做成
  noTrade: boolean // 空手日（今日無交易）
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

export type EntryStatus = 'empty' | 'recorded' | 'reviewed' | 'notrade' | 'notrade_reviewed'

export interface ImagePresence {
  trade: boolean
  raw: boolean
  review: boolean
}
