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
}

export interface RuleGroup {
  id: string
  name: string
  sortOrder: number
}

export interface Rule {
  id: string
  groupId: string
  name: string
  bodyJson: string | null
  sortOrder: number
}

export interface RuleImage {
  id: string
  ruleId: string
  filePath: string
  sortOrder: number
}

export type EntryStatus = 'empty' | 'recorded' | 'reviewed'

export interface ImagePresence {
  trade: boolean
  raw: boolean
  review: boolean
}
