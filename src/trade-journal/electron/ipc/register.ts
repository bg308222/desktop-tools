import { ipcMain, shell } from 'electron'
import path from 'node:path'
import { openDb } from '../db/connection'
import { getDataRoot, getDbPath } from '../paths'
import { createMarketRepo } from '../db/repositories/marketRepo'
import { createEntryRepo, type EntryUpsert } from '../db/repositories/entryRepo'
import { createImageRepo } from '../db/repositories/imageRepo'
import { createTagRepo } from '../db/repositories/tagRepo'
import { createRuleRepo } from '../db/repositories/ruleRepo'
import { createImageStore } from '../images/imageStore'
import { extractRuleIds } from '@shared/mention'
import type { ImageKind, Wlt } from '@shared/domain'
import type { RulePatch } from '@shared/ipc'

function parseDataUrl(dataUrl: string): { ext: string; buffer: Buffer } {
  const m = /^data:image\/([\w+]+);base64,(.+)$/s.exec(dataUrl)
  if (!m) throw new Error('內容不是圖片，無法貼上')
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
  return { ext, buffer: Buffer.from(m[2], 'base64') }
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function registerIpc(): Promise<void> {
  const dataRoot = getDataRoot()
  const db = await openDb(getDbPath())
  const markets = createMarketRepo(db)
  const entries = createEntryRepo(db)
  const images = createImageRepo(db)
  const tags = createTagRepo(db)
  const rules = createRuleRepo(db)
  const store = createImageStore(dataRoot)

  let timer: NodeJS.Timeout | null = null
  const persist = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => db.persist(), 300)
  }

  // read handler
  const r = (channel: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(channel, (_e, ...args) => fn(...(args as never[])))
  }
  // write handler（完成後排程持久化）
  const w = (channel: string, fn: (...args: never[]) => unknown): void => {
    ipcMain.handle(channel, (_e, ...args) => {
      const out = fn(...(args as never[]))
      persist()
      return out
    })
  }

  // markets
  r('markets.list', () => markets.list())
  w('markets.create', (name: string) => markets.create(name))
  w('markets.rename', (id: string, name: string) => markets.rename(id, name))
  w('markets.reorder', (ids: string[]) => markets.reorder(ids))
  w('markets.setArchived', (id: string, archived: boolean) => markets.setArchived(id, archived))

  // entries
  r('entries.get', (marketId: string, date: string) => entries.get(marketId, date))
  w('entries.upsert', (input: EntryUpsert) => entries.upsert(input))
  w('entries.setWlt', (id: string, kind: 'actual' | 'ideal', v: Wlt | null) => entries.setWlt(id, kind, v))
  w('entries.setNote', (id: string, noteJson: string | null) => {
    entries.setNote(id, noteJson)
    rules.setEntryRuleRefs(id, extractRuleIds(noteJson))
  })
  r('entries.listInRange', (from: string, to: string) => entries.listInRange(from, to))
  r('entries.listByMarketInRange', (marketId: string, from: string, to: string) =>
    entries.listByMarketInRange(marketId, from, to),
  )
  r('entries.listByDate', (date: string) => entries.listByDate(date))
  r('entries.listByTagIds', (tagIds: string[]) => entries.listByTagIds(tagIds))

  // images
  r('images.getByEntry', (entryId: string) => images.getByEntry(entryId))
  w('images.paste', (entryId: string, kind: ImageKind, dataUrl: string) => {
    const { ext, buffer } = parseDataUrl(dataUrl)
    const written = store.writeEntryImage(entryId, kind, buffer, ext)
    return images.upsert(entryId, kind, written.filePath, written.width, written.height)
  })
  w('images.remove', (entryId: string, kind: ImageKind) => {
    const existing = images.get(entryId, kind)
    if (existing) store.deleteFile(existing.filePath)
    images.remove(entryId, kind)
  })
  r('images.readDataUrl', (relPath: string) => {
    const buf = store.readBuffer(relPath)
    if (!buf) return null
    const ext = path.extname(relPath).slice(1).toLowerCase()
    const mime = MIME[ext] ?? 'application/octet-stream'
    return `data:${mime};base64,${buf.toString('base64')}`
  })
  w('images.pasteRuleImage', (ruleId: string, dataUrl: string) => {
    const { ext, buffer } = parseDataUrl(dataUrl)
    const written = store.writeRuleImage(ruleId, buffer, ext)
    return rules.addRuleImage(ruleId, written.filePath)
  })

  // tags
  r('tags.list', () => tags.list())
  w('tags.ensure', (name: string) => tags.ensure(name))
  w('tags.setEntryTags', (entryId: string, tagIds: string[]) => tags.setEntryTags(entryId, tagIds))
  r('tags.getEntryTags', (entryId: string) => tags.getEntryTags(entryId))

  // rules
  r('rules.listGroups', () => rules.listGroups())
  w('rules.createGroup', (name: string) => rules.createGroup(name))
  w('rules.reorderGroups', (ids: string[]) => rules.reorderGroups(ids))
  r('rules.list', () => rules.listRules())
  w('rules.create', (groupId: string, name: string) => rules.createRule(groupId, name))
  w('rules.update', (id: string, patch: RulePatch) => rules.updateRule(id, patch))
  w('rules.move', (id: string, groupId: string) => rules.moveRule(id, groupId))
  w('rules.remove', (id: string) => rules.deleteRule(id))
  r('rules.listImages', (ruleId: string) => rules.listRuleImages(ruleId))
  w('rules.removeImage', (id: string) => rules.removeRuleImage(id))
  r('rules.entriesReferencing', (ruleId: string) => rules.entriesReferencing(ruleId))

  // app
  r('app.dataFolder', () => dataRoot)
  r('app.openDataFolder', () => {
    void shell.openPath(dataRoot)
  })
}
