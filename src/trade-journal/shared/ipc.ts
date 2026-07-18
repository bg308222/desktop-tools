import type {
  Entry,
  ImageKind,
  ImageRec,
  Market,
  Rule,
  RuleGroup,
  RuleImage,
  Tag,
  Wlt,
} from './domain'

export interface EntryUpsertInput {
  marketId: string
  tradeDate: string
  actual?: Wlt | null
  ideal?: Wlt | null
  noteJson?: string | null
}

export interface RulePatch {
  name?: string
  bodyJson?: string | null
}

export interface IpcApi {
  markets: {
    list(): Promise<Market[]>
    create(name: string): Promise<Market>
    rename(id: string, name: string): Promise<void>
    reorder(ids: string[]): Promise<void>
    setArchived(id: string, archived: boolean): Promise<void>
  }
  entries: {
    get(marketId: string, date: string): Promise<Entry | null>
    upsert(input: EntryUpsertInput): Promise<Entry>
    setWlt(id: string, kind: 'actual' | 'ideal', v: Wlt | null): Promise<void>
    /** 儲存備註並同步規則引用（entry_rule_ref）。 */
    setNote(id: string, noteJson: string | null): Promise<void>
    listInRange(from: string, to: string): Promise<Entry[]>
    listByMarketInRange(marketId: string, from: string, to: string): Promise<Entry[]>
    listByDate(date: string): Promise<Entry[]>
    listByTagIds(tagIds: string[]): Promise<Entry[]>
  }
  images: {
    getByEntry(entryId: string): Promise<ImageRec[]>
    paste(entryId: string, kind: ImageKind, dataUrl: string): Promise<ImageRec>
    remove(entryId: string, kind: ImageKind): Promise<void>
    readDataUrl(relPath: string): Promise<string | null>
    pasteRuleImage(ruleId: string, dataUrl: string): Promise<RuleImage>
  }
  tags: {
    list(): Promise<Tag[]>
    ensure(name: string): Promise<Tag>
    setEntryTags(entryId: string, tagIds: string[]): Promise<void>
    getEntryTags(entryId: string): Promise<Tag[]>
  }
  rules: {
    listGroups(): Promise<RuleGroup[]>
    createGroup(name: string): Promise<RuleGroup>
    reorderGroups(ids: string[]): Promise<void>
    list(): Promise<Rule[]>
    create(groupId: string, name: string): Promise<Rule>
    update(id: string, patch: RulePatch): Promise<void>
    move(id: string, groupId: string): Promise<void>
    remove(id: string): Promise<void>
    listImages(ruleId: string): Promise<RuleImage[]>
    removeImage(id: string): Promise<void>
    entriesReferencing(ruleId: string): Promise<string[]>
  }
  app: {
    dataFolder(): Promise<string>
    openDataFolder(): Promise<void>
  }
}

/** 所有 IPC channel 名稱（preload 與 main 共用，避免打錯字）。 */
export const CHANNELS = {
  'markets.list': true,
  'markets.create': true,
  'markets.rename': true,
  'markets.reorder': true,
  'markets.setArchived': true,
  'entries.get': true,
  'entries.upsert': true,
  'entries.setWlt': true,
  'entries.setNote': true,
  'entries.listInRange': true,
  'entries.listByMarketInRange': true,
  'entries.listByDate': true,
  'entries.listByTagIds': true,
  'images.getByEntry': true,
  'images.paste': true,
  'images.remove': true,
  'images.readDataUrl': true,
  'images.pasteRuleImage': true,
  'tags.list': true,
  'tags.ensure': true,
  'tags.setEntryTags': true,
  'tags.getEntryTags': true,
  'rules.listGroups': true,
  'rules.createGroup': true,
  'rules.reorderGroups': true,
  'rules.list': true,
  'rules.create': true,
  'rules.update': true,
  'rules.move': true,
  'rules.remove': true,
  'rules.listImages': true,
  'rules.removeImage': true,
  'rules.entriesReferencing': true,
  'app.dataFolder': true,
  'app.openDataFolder': true,
} as const

export type Channel = keyof typeof CHANNELS
