import { existsSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'

// Resolve existing parents too, so a junction cannot redirect a new directory into live data.
function physicalPath(path: string): string {
  const rest: string[] = []
  let parent = path
  while (!existsSync(parent)) {
    rest.unshift(basename(parent))
    const next = dirname(parent)
    if (next === parent) throw new Error('BREEDHAVEN_USER_DATA_DIR must have an existing filesystem root.')
    parent = next
  }
  return resolve(realpathSync(parent), ...rest)
}

function contains(parent: string, child: string): boolean {
  const from = relative(parent, child)
  return from === '' || (!isAbsolute(from) && from !== '..' && !from.startsWith(`..${sep}`))
}

/** An isolated source run must never share a directory tree with the player's data. */
export function developmentDataDir(isPackaged: boolean, directory: string | undefined, userData: string): string | undefined {
  if (isPackaged || directory === undefined) return undefined
  if (!isAbsolute(directory)) throw new Error('BREEDHAVEN_USER_DATA_DIR must be an absolute path.')
  const target = physicalPath(directory)
  const live = physicalPath(userData)
  if (contains(live, target) || contains(target, live)) {
    throw new Error('BREEDHAVEN_USER_DATA_DIR must be separate from the live user-data directory.')
  }
  return target
}
