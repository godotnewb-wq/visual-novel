import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import { dirname } from 'node:path'

export type ConnectionFiles = Pick<typeof fs,
  'readFileSync' | 'mkdirSync' | 'openSync' | 'writeFileSync' | 'fsyncSync' | 'closeSync' | 'renameSync' | 'unlinkSync'>

export function writeExclusive(path: string, bytes: Buffer, files: ConnectionFiles): void {
  files.mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  let fd: number | undefined
  let created = false
  try {
    fd = files.openSync(path, 'wx', 0o600)
    created = true
    files.writeFileSync(fd, bytes)
    files.fsyncSync(fd)
    files.closeSync(fd)
    fd = undefined
  } catch (error) {
    if (fd !== undefined) { try { files.closeSync(fd) } catch { /* Preserve the original failure. */ } }
    if (created) { try { files.unlinkSync(path) } catch { /* A partial file is never used as settings. */ } }
    throw error
  }
}

/** The old file stays in place until the complete replacement has reached disk. */
export function writeConnectionFile(path: string, bytes: Buffer, files: ConnectionFiles, beforeReplace: () => void): void {
  const temporary = `${path}.${randomUUID()}.tmp`
  let written = false
  try {
    writeExclusive(temporary, bytes, files)
    written = true
    beforeReplace()
    files.renameSync(temporary, path)
  } catch (error) {
    if (written) { try { files.unlinkSync(temporary) } catch { /* Leave failed cleanup separate from the write failure. */ } }
    throw error
  }
}
