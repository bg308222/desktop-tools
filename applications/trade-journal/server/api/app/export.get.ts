import { packDir } from '../../utils/archive'

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export default defineEventHandler((event) => {
  const { dataDir } = useRepos()
  setResponseHeader(event, 'Content-Type', 'application/gzip')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="trade-journal-${stamp()}.tgz"`)
  return sendStream(event, packDir(dataDir))
})
