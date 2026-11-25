import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionStore } from './connectionStore'
import { completeWithFallback } from '../ai/router'
import { RefusalError, type chatCompletion } from '../ai/openai'
import { setLanguage } from '../../shared/i18n'

const roots: string[] = []
const cipher = { encrypt: (key: string) => Buffer.from(key).toString('base64'), decrypt: (key: string) => Buffer.from(key, 'base64').toString() }
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'bh-snapshot-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  const store = new ConnectionStore(path, { cipher })
  const primary = store.getView().assignments.main
  store.update({ id: primary, changes: { baseUrl: 'http://one/v1', model: 'original', apiKey: 'key-one', temperature: 0.2, maxTokens: 333, timeoutSeconds: 99, topK: 7, instructions: 'Original instruction', maxConcurrent: 1 } })
  const secondary = store.create({ name: 'Secondary', baseUrl: 'http://two/v1', model: 'secondary', apiKey: 'key-two' }).profiles.find((profile) => profile.name === 'Secondary')!.id
  store.assign({ role: 'nsfw', profileId: secondary })
  return { store, path, primary, secondary }
}
afterEach(() => { setLanguage('en'); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('request snapshots', () => {
  it('retains parameters, keys, roles, preferences, and language across edits and deletion', () => {
    const { store, primary, secondary } = setup()
    setLanguage('test', { 'core.llm.writeIn': 'Captured language' })
    const snapshot = store.snapshot()
    const original = snapshot.main.resolve()
    store.update({ id: primary, changes: { model: 'changed', apiKey: 'replacement', temperature: 1.7, topK: 50, instructions: 'Changed' } })
    store.assign({ role: 'main', profileId: secondary })
    store.assign({ role: 'nsfw', profileId: null })
    store.delete({ id: primary })
    store.updatePreferences({ memoryRecall: 30, newsWebSearch: true })
    setLanguage('en')
    expect(snapshot.main.id).toBe(primary)
    expect(snapshot.main.resolve()).toEqual(original)
    expect(snapshot.nsfw?.resolve().apiKey).toBe('key-two')
    expect(snapshot).toMatchObject({ memoryRecall: 8, newsWebSearch: false, languageInstruction: 'Captured language' })
    const detached = snapshot.main.resolve()
    detached.apiKey = 'caller mutation'
    expect(snapshot.main.resolve().apiKey).toBe('key-one')
  })

  it('keeps the captured fallback when assignments change while the main request is pending', async () => {
    const { store, primary, secondary } = setup()
    const snapshot = store.snapshot()
    const seen: string[] = []
    const complete = (async (profile) => {
      seen.push(`${profile.model}:${profile.apiKey}`)
      if (seen.length === 1) {
        store.update({ id: secondary, changes: { model: 'changed-secondary', apiKey: 'changed-key' } })
        store.assign({ role: 'nsfw', profileId: null })
        store.update({ id: primary, changes: { model: 'changed-main' } })
        await Promise.resolve()
        throw new RefusalError('content filter')
      }
      return 'Hello.'
    }) as typeof chatCompletion
    expect(await completeWithFallback(snapshot, false, { system: 's', messages: [] }, complete)).toMatchObject({ profileId: secondary, profileRole: 'nsfw' })
    expect(seen).toEqual(['original:key-one', 'secondary:key-two'])
    expect(store.snapshot().nsfw).toBeNull()
  })

  it('does not let an unused unavailable key block the selected connection', async () => {
    const { store, path, primary, secondary } = setup()
    const partlyLocked = new ConnectionStore(path, { cipher: { ...cipher, decrypt: (key) => {
      if (cipher.decrypt(key) === 'key-two') throw new Error('Unavailable secondary')
      return cipher.decrypt(key)
    } } })
    const complete = (async () => 'Hello.') as typeof chatCompletion
    expect((await completeWithFallback(partlyLocked.snapshot(), false, { system: 's', messages: [] }, complete)).profileId).toBe(primary)
    await expect(completeWithFallback(partlyLocked.snapshot(), true, { system: 's', messages: [] }, complete)).rejects.toThrow('could not be unlocked')
    const mainLocked = new ConnectionStore(path, { cipher: { ...cipher, decrypt: (key) => {
      if (cipher.decrypt(key) === 'key-one') throw new Error('Unavailable main')
      return cipher.decrypt(key)
    } } })
    expect((await completeWithFallback(mainLocked.snapshot(), true, { system: 's', messages: [] }, complete)).profileId).toBe(secondary)
    expect(store.getView().assignments.main).toBe(primary)
  })

  it('distinguishes routing role from identity even when both roles share one profile', async () => {
    const { store, primary } = setup()
    store.assign({ role: 'nsfw', profileId: primary })
    const complete = (async () => 'Hello.') as typeof chatCompletion
    expect(await completeWithFallback(store.snapshot(), true, { system: 's', messages: [] }, complete)).toMatchObject({ profileId: primary, profileRole: 'nsfw' })
    expect(await completeWithFallback(store.snapshot(), false, { system: 's', messages: [] }, complete)).toMatchObject({ profileId: primary, profileRole: 'main' })
  })
})
