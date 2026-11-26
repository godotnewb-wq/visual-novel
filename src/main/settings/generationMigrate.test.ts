import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GenerationSettingsSchema, GenerationSettingsViewSchema } from '../../shared/generationConnections'
import { ConnectionStore } from './connectionStore'
import { StoredConnectionSettingsSchema } from './migrate'
import { generationLegacyView, migrateGenerationSettings, StoredGenerationSettingsSchema } from './generationMigrate'
import type { ConnectionFiles } from './connectionFiles'

const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222'
const roots: string[] = []
const cipher = { encrypt: (key: string) => `encrypted:${key}`, decrypt: (key: string) => key.slice(10) }
function previous() {
  return StoredConnectionSettingsSchema.parse({ settingsVersion: 2, language: 'zh-CN', memoryRecall: 19, newsWebSearch: true,
    profiles: [{ id: a, name: 'My Writer', baseUrl: 'http://mock/v1', model: 'model-a', apiKey: 'opaque', apiKeyEncrypted: true,
      instructions: 'Keep this.', temperature: 0, topP: 0, minP: 0.1, topK: 0, reasoning: 'off', maxTokens: 2048, maxConcurrent: 2 },
    { id: b, name: 'My Manager', baseUrl: 'http://mock/v1', model: 'model-b', apiKey: '', apiKeyEncrypted: false }],
    assignments: { main: a, nsfw: b } })
}
function location(raw: unknown = previous()) {
  const root = fs.mkdtempSync(join(tmpdir(), 'bh-generation-')); roots.push(root)
  const path = join(root, 'settings.json')
  fs.writeFileSync(path, JSON.stringify(raw, null, 3) + '\n')
  return { path, root }
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

describe('dormant generation settings', () => {
  it('converts without losing prior values or decrypting keys', () => {
    const raw = previous(), copy = structuredClone(raw), next = migrateGenerationSettings(raw)
    expect(next).toMatchObject({ settingsVersion: 3, generationMode: 'legacy', assignments: { ...raw.assignments, writer: null, manager: null } })
    expect(generationLegacyView(next)).toEqual(raw)
    expect(raw).toEqual(copy)
    expect(migrateGenerationSettings(next)).toEqual(next)
  })
  it('can convert legacy settings with supplied identities', () => {
    const next = migrateGenerationSettings({ main: { apiKey: 'private', instructions: 'Original' } }, {
      main: { id: a, name: 'Main' }, nsfw: { id: b, name: 'NSFW' }
    })
    expect(next.profiles[0]).toMatchObject({ id: a, apiKey: 'private', instructions: 'Original' })
    expect(next.assignments).toEqual({ main: a, nsfw: null, writer: null, manager: null })
    expect(() => migrateGenerationSettings({})).toThrow()
  })
  it.each([
    { settingsVersion: 4 }, { unknown: 'keep me' }, { assignments: { main: a, nsfw: null, writer: b, manager: 'missing' } },
    { profiles: [...previous().profiles, previous().profiles[0]] }
  ])('rejects malformed settings instead of dropping values: %j', (patch) => {
    expect(() => migrateGenerationSettings({ ...migrateGenerationSettings(previous()), ...patch })).toThrow()
  })
  it('allows shared assignments, but dual mode needs configured roles', () => {
    const next = migrateGenerationSettings(previous())
    const safe = { ...next, profiles: next.profiles.map(({ apiKey: _key, apiKeyEncrypted: _encrypted, ...profile }) => profile) }
    expect(GenerationSettingsSchema.safeParse({ ...safe, generationMode: 'dual' }).success).toBe(false)
    expect(GenerationSettingsSchema.safeParse({ ...safe, generationMode: 'dual', assignments: { ...safe.assignments, writer: a, manager: a } }).success).toBe(true)
    expect(GenerationSettingsSchema.safeParse({ ...safe, profiles: safe.profiles.map((profile) => ({ ...profile, model: '' })), generationMode: 'dual', assignments: { ...safe.assignments, writer: a, manager: a } }).success).toBe(false)
  })
  it('backs up exact v2 bytes once; keeps encrypted values and optional preferences', () => {
    const { path, root } = location(), bytes = fs.readFileSync(path)
    const store = new ConnectionStore(path, { generation: true })
    expect(fs.readFileSync(store.migrationBackupPath!)).toEqual(bytes)
    expect(store.getGenerationView()).toMatchObject({ language: 'zh-CN', memoryRecall: 19, newsWebSearch: true, generationMode: 'legacy' })
    const makeId = vi.fn(() => { throw new Error('Must keep identity') })
    expect(new ConnectionStore(path, { generation: true, makeId }).getGenerationView()).toEqual(store.getGenerationView())
    expect(makeId).not.toHaveBeenCalled()
    expect(fs.readdirSync(root).filter((file) => file.includes('.pre-v3-'))).toHaveLength(1)
    expect(JSON.parse(fs.readFileSync(path, 'utf8')).profiles[0].apiKey).toBe('opaque')
  })
  it('encrypts legacy plaintext or leaves the entire original untouched', () => {
    const { path, root } = location({ main: { apiKey: 'private' } }), bytes = fs.readFileSync(path)
    expect(() => new ConnectionStore(path, { generation: true })).toThrow()
    expect(fs.readFileSync(path)).toEqual(bytes)
    expect(fs.readdirSync(root)).toEqual(['settings.json'])
    const store = new ConnectionStore(path, { generation: true, cipher })
    expect(fs.readFileSync(store.migrationBackupPath!)).toEqual(bytes)
    expect(store.getProfile(store.getView().assignments.main).apiKey).toBe('private')
    expect(fs.readFileSync(path, 'utf8')).not.toContain('"apiKey": "private"')
  })
  it('persists independent references through legacy CRUD and protects assigned profiles', () => {
    const { path } = location()
    const store = new ConnectionStore(path, { generation: true })
    store.assignGeneration({ role: 'writer', profileId: a }); store.assignGeneration({ role: 'manager', profileId: b })
    store.assign({ role: 'nsfw', profileId: null }); store.assign({ role: 'main', profileId: b })
    expect(() => store.delete({ id: a })).toThrow()
    store.rename({ id: a, name: 'Renamed Writer' })
    store.updatePreferences({ memoryRecall: 8 })
    expect(new ConnectionStore(path, { generation: true }).getGenerationView()).toMatchObject({ assignments: { main: b, nsfw: null, writer: a, manager: b }, memoryRecall: 8 })
    store.assignGeneration({ role: 'writer', profileId: b }); store.delete({ id: a })
    expect(store.getGenerationView().profiles).toHaveLength(1)
  })
  it('excludes credentials from views and snapshots retain all captured values', () => {
    const raw = previous(); raw.profiles[0].apiKey = cipher.encrypt('private')
    const { path } = location(raw)
    const store = new ConnectionStore(path, { generation: true, cipher })
    store.assignGeneration({ role: 'writer', profileId: a }); store.assignGeneration({ role: 'manager', profileId: b })
    const snapshot = store.generationSnapshot()
    store.update({ id: a, changes: { model: 'changed', apiKey: 'changed', instructions: 'changed' } })
    expect(snapshot.writer!.resolve()).toMatchObject({ model: 'model-a', apiKey: 'private', instructions: 'Keep this.', topP: 0 })
    const mutable = snapshot.writer!.resolve(); mutable.model = 'mutated'
    expect(snapshot.writer!.resolve().model).toBe('model-a')
    expect(Object.isFrozen(snapshot.writer!.parameters)).toBe(true)
    expect(JSON.stringify(store.getGenerationView())).not.toContain('private')
    expect(GenerationSettingsViewSchema.safeParse({ ...store.getGenerationView(), profiles: raw.profiles }).success).toBe(false)
  })
  it('rolls back a failed assignment and rejects stale writers', () => {
    const { path } = location()
    const files: ConnectionFiles = { ...fs, renameSync: vi.fn(fs.renameSync) }
    const store = new ConnectionStore(path, { generation: true, files }), bytes = fs.readFileSync(path)
    vi.mocked(files.renameSync).mockImplementationOnce(() => { throw new Error('Disk failure') })
    expect(() => store.assignGeneration({ role: 'writer', profileId: a })).toThrow()
    expect(store.getGenerationView().assignments.writer).toBeNull()
    expect(fs.readFileSync(path)).toEqual(bytes)
    const other = new ConnectionStore(path, { generation: true })
    other.assignGeneration({ role: 'manager', profileId: b })
    const current = fs.readFileSync(path)
    expect(() => store.assignGeneration({ role: 'writer', profileId: a })).toThrow()
    expect(fs.readFileSync(path)).toEqual(current)
  })
  it('keeps the v2 compatibility opt-out, refuses downgrade, and restores an explicitly enabled Dual mode', () => {
    const { path } = location(), bytes = fs.readFileSync(path)
    expect(new ConnectionStore(path).getView().settingsVersion).toBe(2)
    expect(fs.readFileSync(path)).toEqual(bytes)
    expect(() => new ConnectionStore(path).getGenerationView()).toThrow()
    new ConnectionStore(path, { generation: true })
    const converted = fs.readFileSync(path)
    expect(() => new ConnectionStore(path)).toThrow()
    expect(fs.readFileSync(path)).toEqual(converted)
    const next = JSON.parse(converted.toString()); next.generationMode = 'dual'; next.assignments.writer = a; next.assignments.manager = b
    StoredGenerationSettingsSchema.parse(next)
    fs.writeFileSync(path, JSON.stringify(next))
    expect(new ConnectionStore(path, { generation: true }).getGenerationView().generationMode).toBe('dual')
    expect(JSON.parse(fs.readFileSync(path, 'utf8'))).toEqual(next)
  })
})
