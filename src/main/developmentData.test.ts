import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { developmentDataDir } from './developmentData'

const roots: string[] = []
function directories() {
  const root = mkdtempSync(join(tmpdir(), 'bh-development-'))
  roots.push(root)
  const live = join(root, 'live')
  mkdirSync(live)
  return { root, live, isolated: join(root, 'isolated', 'user-data') }
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('isolated development data', () => {
  it('leaves ordinary and packaged runs alone', () => {
    const { live } = directories()
    expect(developmentDataDir(false, undefined, live)).toBeUndefined()
    expect(developmentDataDir(true, live, live)).toBeUndefined()
  })

  it('rejects relative and empty overrides', () => {
    const { live } = directories()
    for (const path of ['', 'relative/path']) {
      expect(() => developmentDataDir(false, path, live)).toThrow('absolute path')
    }
  })

  it('rejects the live directory, its children, and its parents', () => {
    const { root, live } = directories()
    for (const path of [live, join(live, 'test'), root]) {
      expect(() => developmentDataDir(false, path, live)).toThrow('separate')
    }
  })

  it('accepts a separate tree without creating it', () => {
    const { live, isolated } = directories()
    expect(developmentDataDir(false, isolated, live)).toBe(isolated)
    expect(existsSync(isolated)).toBe(false)
  })

  it('rejects junctions or symlinks into live data, including nonexistent children', () => {
    const { root, live } = directories()
    const alias = join(root, 'alias')
    symlinkSync(live, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(() => developmentDataDir(false, alias, live)).toThrow('separate')
    expect(() => developmentDataDir(false, join(alias, 'test'), live)).toThrow('separate')
  })
})
