import { app } from 'electron'
import path from 'node:path'

export function getDataRoot(): string {
  return path.join(app.getPath('userData'), 'trade-journal')
}

export function getDbPath(): string {
  return path.join(getDataRoot(), 'journal.db')
}
