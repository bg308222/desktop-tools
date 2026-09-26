import fs from 'node:fs'
import { computeDataStatus } from '../../utils/dataStatus'

export default defineEventHandler(() => {
  const { db, store } = useRepos()
  return computeDataStatus(db, (rel) => fs.existsSync(store.absPath(rel)))
})
