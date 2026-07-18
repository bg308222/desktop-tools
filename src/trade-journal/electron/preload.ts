import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from '@shared/ipc'

const invoke =
  (channel: string) =>
  (...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args)

const api: IpcApi = {
  markets: {
    list: invoke('markets.list'),
    create: invoke('markets.create'),
    rename: invoke('markets.rename'),
    reorder: invoke('markets.reorder'),
    setArchived: invoke('markets.setArchived'),
  },
  entries: {
    get: invoke('entries.get'),
    upsert: invoke('entries.upsert'),
    setWlt: invoke('entries.setWlt'),
    setNote: invoke('entries.setNote'),
    listInRange: invoke('entries.listInRange'),
    listByMarketInRange: invoke('entries.listByMarketInRange'),
    listByDate: invoke('entries.listByDate'),
    listByTagIds: invoke('entries.listByTagIds'),
  },
  images: {
    getByEntry: invoke('images.getByEntry'),
    paste: invoke('images.paste'),
    remove: invoke('images.remove'),
    readDataUrl: invoke('images.readDataUrl'),
    pasteRuleImage: invoke('images.pasteRuleImage'),
  },
  tags: {
    list: invoke('tags.list'),
    ensure: invoke('tags.ensure'),
    setEntryTags: invoke('tags.setEntryTags'),
    getEntryTags: invoke('tags.getEntryTags'),
  },
  rules: {
    listGroups: invoke('rules.listGroups'),
    createGroup: invoke('rules.createGroup'),
    reorderGroups: invoke('rules.reorderGroups'),
    list: invoke('rules.list'),
    create: invoke('rules.create'),
    update: invoke('rules.update'),
    move: invoke('rules.move'),
    remove: invoke('rules.remove'),
    listImages: invoke('rules.listImages'),
    removeImage: invoke('rules.removeImage'),
    entriesReferencing: invoke('rules.entriesReferencing'),
  },
  app: {
    dataFolder: invoke('app.dataFolder'),
    openDataFolder: invoke('app.openDataFolder'),
  },
} as unknown as IpcApi

contextBridge.exposeInMainWorld('api', api)
