import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { writeExclusive } from './connectionFiles'

it('never overwrites or removes an existing backup when exclusive creation fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'bh-connection-backup-'))
  try {
    const path = join(root, 'settings.pre-v2.bak')
    writeFileSync(path, 'original backup')
    expect(() => writeExclusive(path, Buffer.from('replacement'), fs)).toThrow()
    expect(readFileSync(path, 'utf8')).toBe('original backup')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
