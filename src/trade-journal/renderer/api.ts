import type { IpcApi } from '@shared/ipc'

/** 型別化的 IPC 入口。錯誤處理包裝於 Task 19 加上。 */
export const api: IpcApi = window.api
