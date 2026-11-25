import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionStore } from './connectionStore'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'bh-activation-'))
  roots.push(root)
  return join(root, 'settings.json')
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('settings format activation', () => {
  it('converts both legacy roles once and preserves their identities after restart', () => {
    const path = fixture()
    writeFileSync(path, JSON.stringify({ main: { baseUrl: 'http://main/v1', model: 'm' }, nsfw: { baseUrl: 'http://secondary/v1', model: 'n' }, language: 'zh-CN', memoryRecall: 20, newsWebSearch: true }))
    const first = new ConnectionStore(path)
    const view = first.getView()
    const snapshot = first.snapshot()
    expect(snapshot.main.resolve().model).toBe('m')
    expect(snapshot.nsfw?.resolve().model).toBe('n')
    expect(JSON.parse(readFileSync(path, 'utf8')).settingsVersion).toBe(2)
    expect(new ConnectionStore(path).getView()).toEqual(view)
    expect(new ConnectionStore(path).migrationBackupPath).toBeUndefined()
    expect(view).toMatchObject({ language: 'zh-CN', memoryRecall: 20, newsWebSearch: true })
  })

  it('does not reset corrupt settings to defaults during startup', () => {
    const path = fixture()
    writeFileSync(path, '{not settings')
    expect(() => new ConnectionStore(path)).toThrow('original file was kept')
    expect(readFileSync(path, 'utf8')).toBe('{not settings')
  })
})
