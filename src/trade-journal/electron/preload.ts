import { contextBridge } from 'electron'

// Task 11 會依 IpcApi 逐一填入方法。
contextBridge.exposeInMainWorld('api', {})
