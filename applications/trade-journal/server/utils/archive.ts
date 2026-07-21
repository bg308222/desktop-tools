import * as tar from 'tar'
import type { Readable } from 'node:stream'

/** 把整個目錄打包成 gzip tar 串流（供匯出下載）。 */
export function packDir(dir: string): Readable {
  return tar.c({ gzip: true, cwd: dir }, ['.']) as unknown as Readable
}

/** 把 tgz 解壓到目標目錄（供匯入還原）。 */
export async function extractTgzTo(file: string, dir: string): Promise<void> {
  await tar.x({ file, cwd: dir })
}
