import { notifications } from '@mantine/notifications'
import type { IpcApi } from '@shared/ipc'

/** 包裝每個 IPC 方法：失敗時彈出通知並沿用拋出，讓呼叫端邏輯中止。 */
function wrapGroup<T extends object>(group: T): T {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(group)) {
    const fn = (group as Record<string, unknown>)[key]
    if (typeof fn === 'function') {
      out[key] = async (...args: unknown[]): Promise<unknown> => {
        try {
          return await (fn as (...a: unknown[]) => unknown)(...args)
        } catch (e) {
          const message = e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*':\s*/, '') : String(e)
          notifications.show({ color: 'red', title: '操作失敗', message })
          throw e
        }
      }
    } else {
      out[key] = fn
    }
  }
  return out as T
}

const raw = window.api

export const api: IpcApi = {
  markets: wrapGroup(raw.markets),
  entries: wrapGroup(raw.entries),
  images: wrapGroup(raw.images),
  tags: wrapGroup(raw.tags),
  rules: wrapGroup(raw.rules),
  app: wrapGroup(raw.app),
}
