import type {
  Market,
  Entry,
  EntryWithPresence,
  ImageRec,
  ImageKind,
  Tag,
  TagImage,
  Wlt,
} from '../../shared/domain'

export interface EntryUpsertInput {
  marketId: string
  tradeDate: string
  actual?: Wlt | null
  ideal?: Wlt | null
  would?: Wlt | null
  noTrade?: boolean
  noteJson?: string | null
}

/** 型別化 API client：包 $fetch，失敗時彈 toast 並沿用拋出。 */
export function useApi() {
  const toast = useToast()

  async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; statusMessage?: string; message?: string }
      const msg = (err?.data?.message || err?.statusMessage || err?.message || '未知錯誤').replace(
        /^.*?:\s*/,
        '',
      )
      toast.add({ color: 'error', title: '操作失敗', description: msg })
      throw e
    }
  }

  const q = (o: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as Record<string, string>

  return {
    markets: {
      list: () => call(() => $fetch<Market[]>('/api/markets')),
      create: (name: string) =>
        call(() => $fetch<Market>('/api/markets', { method: 'POST', body: { name } })),
      rename: (id: string, name: string) =>
        call(() => $fetch(`/api/markets/${id}`, { method: 'PATCH', body: { name } })),
      setArchived: (id: string, archived: boolean) =>
        call(() => $fetch(`/api/markets/${id}`, { method: 'PATCH', body: { archived } })),
      reorder: (ids: string[]) =>
        call(() => $fetch('/api/markets/reorder', { method: 'POST', body: { ids } })),
    },
    entries: {
      get: (marketId: string, date: string) =>
        call(() => $fetch<Entry | null>('/api/entries', { query: { market: marketId, date } })),
      upsert: (input: EntryUpsertInput) =>
        call(() => $fetch<Entry>('/api/entries', { method: 'PUT', body: input })),
      setWlt: (id: string, kind: 'actual' | 'ideal' | 'would', value: Wlt | null) =>
        call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { wlt: { kind, value } } })),
      setNoTrade: (id: string, noTrade: boolean) =>
        call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { noTrade } })),
      setNote: (id: string, noteJson: string | null) =>
        call(() => $fetch(`/api/entries/${id}`, { method: 'PATCH', body: { noteJson } })),
      listInRange: (from: string, to: string) =>
        call(() => $fetch<Entry[]>('/api/entries', { query: { from, to } })),
      listByMarketInRange: (marketId: string, from: string, to: string) =>
        call(() => $fetch<Entry[]>('/api/entries', { query: { market: marketId, from, to } })),
      listByDate: (date: string) =>
        call(() => $fetch<Entry[]>('/api/entries', { query: { date } })),
      listByTagIds: (tagIds: string[]) =>
        call(() => $fetch<Entry[]>('/api/entries', { query: { tags: tagIds.join(',') } })),
      dates: () => call(() => $fetch<string[]>('/api/entries/dates')),
    },
    images: {
      getByEntry: (entryId: string) =>
        call(() => $fetch<ImageRec[]>('/api/images', { query: { entry: entryId } })),
      paste: (entryId: string, kind: ImageKind, dataUrl: string) =>
        call(() => $fetch<ImageRec>('/api/images', { method: 'POST', body: { entryId, kind, dataUrl } })),
      pasteTagImage: (tagId: string, dataUrl: string) =>
        call(() => $fetch<TagImage>('/api/images', { method: 'POST', body: { tagId, dataUrl } })),
      remove: (entryId: string, kind: ImageKind) =>
        call(() => $fetch('/api/images', { method: 'DELETE', query: q({ entry: entryId, kind }) })),
    },
    tags: {
      list: () => call(() => $fetch<Tag[]>('/api/tags')),
      ensure: (name: string) =>
        call(() => $fetch<Tag>('/api/tags', { method: 'POST', body: { name } })),
      rename: (id: string, name: string) =>
        call(() => $fetch(`/api/tags/${id}`, { method: 'PATCH', body: { name } })),
      setColor: (id: string, color: string | null) =>
        call(() => $fetch(`/api/tags/${id}`, { method: 'PATCH', body: { color } })),
      setBody: (id: string, body: string | null) =>
        call(() => $fetch(`/api/tags/${id}`, { method: 'PATCH', body: { body } })),
      remove: (id: string) => call(() => $fetch(`/api/tags/${id}`, { method: 'DELETE' })),
      listImages: (tagId: string) => call(() => $fetch<TagImage[]>(`/api/tags/${tagId}/images`)),
      removeImage: (id: string) =>
        call(() => $fetch(`/api/tag-images/${id}`, { method: 'DELETE' })),
      getEntryTags: (entryId: string) =>
        call(() => $fetch<Tag[]>('/api/tags/entry', { query: { entry: entryId } })),
      setEntryTags: (entryId: string, tagIds: string[]) =>
        call(() => $fetch('/api/tags/entry', { method: 'POST', body: { entryId, tagIds } })),
    },
    overview: {
      list: (marketId: string, from: string, to: string) =>
        call(() =>
          $fetch<EntryWithPresence[]>('/api/overview', { query: { market: marketId, from, to } }),
        ),
    },
    app: {
      dataFolder: () =>
        call(() => $fetch<{ path: string }>('/api/app/data-folder').then((r) => r.path)),
    },
  }
}
