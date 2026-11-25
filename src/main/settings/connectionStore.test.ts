import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionStore } from './connectionStore'
import { ConnectionStoreError } from './connectionErrors'
import type { ConnectionFiles } from './connectionFiles'
import type { KeyCipher } from './store'
import type { ConnectionErrorCode } from '../../shared/llmConnections'

const roots: string[] = []
const cipher: KeyCipher = {
  encrypt: (plain) => `encrypted:${Buffer.from(plain).toString('base64')}`,
  decrypt: (stored) => {
    if (!stored.startsWith('encrypted:')) throw new Error('Private cipher diagnostic')
    return Buffer.from(stored.slice(10), 'base64').toString()
  }
}
const connection = {
  name: 'Hosted', baseUrl: 'http://local/v1', model: 'model-a', apiKey: 'test-only-private-key',
  temperature: 0, maxTokens: 2000, timeoutSeconds: 300, instructions: 'Test instruction',
  reasoning: 'off', reasoningStyle: 'template', topP: 0, minP: 0.1, topK: 0, repetitionPenalty: 1.2,
  frequencyPenalty: -1, presencePenalty: 1, providerOrder: 'A,B', providerIgnore: 'C', allowFallbacks: false, maxConcurrent: 2
}
function location(raw?: unknown) {
  const root = fs.mkdtempSync(join(tmpdir(), 'bh-connections-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  if (raw !== undefined) fs.writeFileSync(path, JSON.stringify(raw, null, 2))
  return { path, root }
}
function expectCode(action: () => unknown, code: ConnectionErrorCode) {
  try { action(); throw new Error('Expected a connection error') } catch (error) {
    expect(error).toBeInstanceOf(ConnectionStoreError)
    expect((error as ConnectionStoreError).code).toBe(code)
    expect((error as Error).message).not.toContain(connection.apiKey)
  }
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

describe('connection persistence', () => {
  it('persists first-run identity and safe defaults across restarts', () => {
    const { path, root } = location()
    const store = new ConnectionStore(path)
    const before = store.getView()
    expect(before.profiles).toHaveLength(1)
    expect(before.encryptionAvailable).toBe(false)
    expect(before.assignments.nsfw).toBeNull()
    expect(new ConnectionStore(path).getView()).toEqual(before)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
    expect(fs.readFileSync(path, 'utf8').endsWith('\n')).toBe(true)
    if (process.platform !== 'win32') expect(fs.statSync(path).mode & 0o777).toBe(0o600)
  })

  it('backs up exact legacy bytes and encrypts plaintext credentials before migration', () => {
    const { name: _name, ...main } = connection
    const { path, root } = location()
    const original = Buffer.from(`{\n\t"main":${JSON.stringify(main)},"language":"zh-CN","memoryRecall":19,"newsWebSearch":true\n}\n`)
    fs.writeFileSync(path, original)
    const store = new ConnectionStore(path, { cipher })
    expect(fs.readFileSync(store.migrationBackupPath!)).toEqual(original)
    expect(store.getView()).toMatchObject({ language: 'zh-CN', memoryRecall: 19, newsWebSearch: true })
    expect(store.getProfile(store.getView().assignments.main)).toEqual(main)
    expect(fs.readFileSync(path, 'utf8')).not.toContain(connection.apiKey)
    expect(fs.readdirSync(root).filter((file) => file.endsWith('.bak'))).toHaveLength(1)
    const makeId = vi.fn(() => { throw new Error('Must not replace IDs') })
    expect(new ConnectionStore(path, { cipher, makeId }).getView()).toEqual(store.getView())
    expect(makeId).not.toHaveBeenCalled()
    expect(fs.readFileSync(store.migrationBackupPath!)).toEqual(original)
  })

  it('retains encrypted keys and draft secondary settings when secure storage is unavailable', () => {
    const encrypted = cipher.encrypt(connection.apiKey)
    const { path } = location({ main: { baseUrl: 'http://local/v1', model: 'a', apiKey: encrypted, apiKeyEncrypted: true }, nsfw: { instructions: 'Unfinished', apiKey: 'opaque-draft', apiKeyEncrypted: true } })
    const store = new ConnectionStore(path)
    const view = store.getView()
    expect(view.profiles).toHaveLength(2)
    expect(view.profiles.every((profile) => profile.hasApiKey)).toBe(true)
    expect(view.assignments.nsfw).toBeNull()
    expectCode(() => store.getProfile(view.assignments.main), 'credential-unavailable')
    store.create({ name: 'Keyless', baseUrl: 'http://other/v1', model: 'other' })
    expect(JSON.parse(fs.readFileSync(path, 'utf8')).profiles[0].apiKey).toBe(encrypted)
    expect(new ConnectionStore(path, { cipher }).getProfile(view.assignments.main).apiKey).toBe(connection.apiKey)
  })

  it('blocks plaintext migration without a cipher and keeps the original recoverable', () => {
    const { path, root } = location({ main: { apiKey: connection.apiKey } })
    const original = fs.readFileSync(path)
    expectCode(() => new ConnectionStore(path), 'encryption-unavailable')
    expect(fs.readFileSync(path)).toEqual(original)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
    expect(new ConnectionStore(path, { cipher }).getView().profiles[0].hasApiKey).toBe(true)
  })

  it.each(['{bad json', 'null', '{"main":{"unknownSampler":1}}', '{"settingsVersion":3}'])('keeps invalid existing data intact: %s', (contents) => {
    const { path, root } = location()
    fs.writeFileSync(path, contents)
    expectCode(() => new ConnectionStore(path, { cipher }), 'invalid-settings')
    expect(fs.readFileSync(path, 'utf8')).toBe(contents)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
  })

  it('reports read failure without exposing filesystem diagnostics', () => {
    const { path } = location({})
    const files = { ...fs, readFileSync: () => { throw new Error(connection.apiKey) } } as ConnectionFiles
    expectCode(() => new ConnectionStore(path, { files }), 'read-failed')
  })

  it('stops migration if its protected backup cannot be written', () => {
    const { path, root } = location({})
    const original = fs.readFileSync(path)
    const files = { ...fs, openSync: () => { throw new Error(connection.apiKey) } } as ConnectionFiles
    expectCode(() => new ConnectionStore(path, { files }), 'backup-failed')
    expect(fs.readFileSync(path)).toEqual(original)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
  })

  it('keeps successful backups through a failed migration and does not overwrite them on retry', () => {
    const { path, root } = location({ main: { model: 'draft' } })
    const original = fs.readFileSync(path)
    const files = { ...fs, renameSync: () => { throw new Error(connection.apiKey) } }
    expectCode(() => new ConnectionStore(path, { files }), 'write-failed')
    const first = fs.readdirSync(root).find((file) => file.endsWith('.bak'))!
    expect(fs.readFileSync(join(root, first))).toEqual(original)
    expect(fs.readFileSync(path)).toEqual(original)
    expect(fs.readdirSync(root).some((file) => file.endsWith('.tmp'))).toBe(false)
    new ConnectionStore(path)
    expect(fs.readdirSync(root).filter((file) => file.endsWith('.bak'))).toHaveLength(2)
    expect(fs.readFileSync(join(root, first))).toEqual(original)
  })

  it.each(['open', 'write', 'flush', 'close', 'rename'] as const)('keeps memory and disk unchanged after a %s failure, and can retry', (phase) => {
    const { path, root } = location()
    const files = { ...fs }
    const store = new ConnectionStore(path, { files })
    const original = fs.readFileSync(path)
    const before = store.getView()
    if (phase === 'open') files.openSync = () => { throw new Error(connection.apiKey) }
    if (phase === 'write') files.writeFileSync = (file) => { fs.writeFileSync(file, 'partial'); throw new Error(connection.apiKey) }
    if (phase === 'flush') files.fsyncSync = () => { throw new Error(connection.apiKey) }
    if (phase === 'close') {
      let once = true
      files.closeSync = (fd) => { if (once) { once = false; throw new Error(connection.apiKey) } fs.closeSync(fd) }
    }
    if (phase === 'rename') files.renameSync = () => { throw new Error(connection.apiKey) }
    expectCode(() => store.create({ name: 'Attempt' }), 'write-failed')
    expect(store.getView()).toEqual(before)
    expect(fs.readFileSync(path)).toEqual(original)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
    Object.assign(files, fs)
    expect(store.create({ name: 'Attempt' }).profiles).toHaveLength(2)
  })

  it('rejects stale writes from another store or external editor', () => {
    const { path } = location()
    const first = new ConnectionStore(path)
    const stale = new ConnectionStore(path)
    first.rename({ id: first.getView().assignments.main, name: 'Changed elsewhere' })
    const currentBytes = fs.readFileSync(path)
    const staleView = stale.getView()
    expectCode(() => stale.create({ name: 'Stale' }), 'settings-changed')
    expect(fs.readFileSync(path)).toEqual(currentBytes)
    expect(stale.getView()).toEqual(staleView)
  })

  it('keeps views and resolved snapshots detached from stored state', () => {
    const { path } = location()
    const store = new ConnectionStore(path, { cipher })
    store.create(connection)
    const view = store.getView()
    const created = view.profiles.find((profile) => profile.name === connection.name)!
    const resolved = store.getProfile(created.id)
    created.name = 'Changed only in caller'
    view.assignments.main = created.id
    resolved.apiKey = 'Changed only in caller'
    expect(store.getView().profiles.some((profile) => profile.name === connection.name)).toBe(true)
    expect(store.getProfile(created.id).apiKey).toBe(connection.apiKey)
    expect(JSON.stringify(store.getView())).not.toContain('apiKey')
  })
})

describe('connection operations', () => {
  it('preserves omitted fields and keys through edits, renames, preferences, and reloads', () => {
    const { path } = location()
    const store = new ConnectionStore(path, { cipher })
    const created = store.create(connection).profiles.find((profile) => profile.name === connection.name)!
    const before = store.getProfile(created.id)
    store.update({ id: created.id, changes: { model: 'model-b' } })
    store.rename({ id: created.id, name: ' Renamed ' })
    store.updatePreferences({ language: 'zh-CN', newsWebSearch: true })
    store.updatePreferences({ memoryRecall: 17 })
    expect(store.getProfile(created.id)).toEqual({ ...before, model: 'model-b' })
    expect(store.getView()).toMatchObject({ language: 'zh-CN', newsWebSearch: true, memoryRecall: 17 })
    const reloaded = new ConnectionStore(path, { cipher })
    expect(reloaded.getView()).toEqual(store.getView())
    expect(reloaded.getView().profiles.find((profile) => profile.id === created.id)?.name).toBe('Renamed')
    store.update({ id: created.id, changes: { apiKey: '', topP: undefined } })
    expect(store.getProfile(created.id)).toMatchObject({ apiKey: '', topP: undefined })
    expect(store.getView().profiles.find((profile) => profile.id === created.id)?.hasApiKey).toBe(false)
  })

  it('encrypts changed keys and leaves earlier settings intact when encryption fails', () => {
    const { path } = location()
    const working = { ...cipher }
    const store = new ConnectionStore(path, { cipher: working })
    const id = store.getView().assignments.main
    store.update({ id, changes: { apiKey: connection.apiKey } })
    expect(fs.readFileSync(path, 'utf8')).not.toContain(connection.apiKey)
    const before = fs.readFileSync(path)
    working.encrypt = () => { throw new Error('sensitive replacement key') }
    expectCode(() => store.update({ id, changes: { apiKey: 'sensitive replacement key' } }), 'encryption-unavailable')
    expect(fs.readFileSync(path)).toEqual(before)
    expect(store.getProfile(id).apiKey).toBe(connection.apiKey)
  })

  it('allows keyless operations without encryption and refuses new saved keys', () => {
    const { path } = location()
    const store = new ConnectionStore(path)
    const id = store.getView().assignments.main
    const before = fs.readFileSync(path)
    expectCode(() => store.update({ id, changes: { apiKey: connection.apiKey } }), 'encryption-unavailable')
    expectCode(() => store.create(connection), 'encryption-unavailable')
    expect(fs.readFileSync(path)).toEqual(before)
    expect(store.update({ id, changes: { model: 'local', baseUrl: 'http://local/v1', apiKey: '' } }).profiles[0].model).toBe('local')
  })

  it.each(['throws', 'returns empty'] as const)('never clears unavailable credentials when decryption %s', (failure) => {
    const { path } = location()
    const original = new ConnectionStore(path, { cipher })
    const id = original.getView().assignments.main
    original.update({ id, changes: { apiKey: connection.apiKey } })
    const wrong = { encrypt: cipher.encrypt, decrypt: () => { if (failure === 'returns empty') return ''; throw new Error(connection.apiKey) } }
    const store = new ConnectionStore(path, { cipher: wrong })
    const before = fs.readFileSync(path)
    expectCode(() => store.getProfile(id), 'credential-unavailable')
    expect(fs.readFileSync(path)).toEqual(before)
    expect(store.getView().profiles[0].hasApiKey).toBe(true)
    store.rename({ id, name: 'Still saved' })
    expect(new ConnectionStore(path, { cipher }).getProfile(id).apiKey).toBe(connection.apiKey)
    store.update({ id, changes: { apiKey: '' } })
    expect(store.getProfile(id).apiKey).toBe('')
  })

  it('does not perpetuate plaintext found in a version-2 file when encryption is unavailable', () => {
    const { path } = location()
    const initial = new ConnectionStore(path)
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'))
    raw.profiles[0].apiKey = connection.apiKey
    raw.profiles[0].apiKeyEncrypted = false
    fs.writeFileSync(path, JSON.stringify(raw))
    const before = fs.readFileSync(path)
    const store = new ConnectionStore(path)
    expectCode(() => store.rename({ id: initial.getView().assignments.main, name: 'Cannot rewrite plaintext' }), 'encryption-unavailable')
    expect(fs.readFileSync(path)).toEqual(before)
    store.update({ id: initial.getView().assignments.main, changes: { apiKey: '' } })
    expect(fs.readFileSync(path, 'utf8')).not.toContain(connection.apiKey)
  })

  it('duplicates only nonsecret parameters and never decrypts the source', () => {
    const { path } = location()
    const store = new ConnectionStore(path, { cipher })
    const source = store.create(connection).profiles.find((profile) => profile.name === connection.name)!
    const locked = new ConnectionStore(path)
    const duplicated = locked.duplicate({ id: source.id, name: 'Copy' }).profiles.find((profile) => profile.name === 'Copy')!
    expect(duplicated.id).not.toBe(source.id)
    expect(duplicated).toEqual({ ...source, id: duplicated.id, name: 'Copy', hasApiKey: false })
    expect(locked.getProfile(duplicated.id).apiKey).toBe('')
    expect(locked.getView().assignments).toEqual(store.getView().assignments)
  })

  it('protects assigned profiles and supports reassignment, unsetting secondary, and deletion', () => {
    const { path } = location()
    const store = new ConnectionStore(path)
    const main = store.getView().assignments.main
    const other = store.create({ name: 'Other' }).profiles.find((profile) => profile.name === 'Other')!.id
    store.assign({ role: 'nsfw', profileId: other })
    expectCode(() => store.delete({ id: main }), 'profile-assigned')
    expectCode(() => store.delete({ id: other }), 'profile-assigned')
    expectCode(() => store.assign({ role: 'main', profileId: null }), 'invalid-request')
    store.assign({ role: 'main', profileId: other })
    store.assign({ role: 'nsfw', profileId: null })
    store.delete({ id: main })
    expect(new ConnectionStore(path).getView()).toEqual(store.getView())
    expect(store.getView().profiles).toHaveLength(1)
  })

  it('rejects invalid names, references, identity edits, and credential reuse arguments without writes', () => {
    const { path } = location()
    const store = new ConnectionStore(path)
    const view = store.getView()
    const id = view.assignments.main
    const original = fs.readFileSync(path)
    const invalid = [
      () => store.create({ name: ` ${view.profiles[0].name.toUpperCase()} ` }),
      () => store.create({ name: '  ' }),
      () => store.update({ id, changes: { id: randomUUID() } }),
      () => store.update({ id, changes: { apiKeyEncrypted: true } }),
      () => store.duplicate({ id, name: 'Copy', reuseCredential: true }),
      () => store.updatePreferences({ memoryRecall: 0 }),
      () => store.create({ name: 'Bad', temperature: 3 })
    ]
    for (const action of invalid) expectCode(action, 'invalid-request')
    expectCode(() => store.assign({ role: 'nsfw', profileId: randomUUID() }), 'profile-not-found')
    expect(fs.readFileSync(path)).toEqual(original)
    expect(store.getView()).toEqual(view)
  })
})
