import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { ConnectionStore } from '../../main/settings/connectionStore'
import { connectionPreferences, libraryDirty, libraryDraft, libraryProfile, uniqueConnectionName } from './connectionLibrary'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
const cipher = { encrypt: (key: string) => `test:${key}`, decrypt: (stored: string) => stored.slice(5) }

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'bh-library-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  writeFileSync(path, JSON.stringify({ main: { baseUrl: 'http://mock/v1', model: 'first', apiKey: 'fixture-key', topP: 0, topK: 0, allowFallbacks: false }, nsfw: { instructions: 'Unfinished secondary' }, memoryRecall: 17, newsWebSearch: true }))
  return { path, store: new ConnectionStore(path, { cipher }) }
}

it('edits a preserved unassigned draft without activating it or resetting globals', () => {
  const { store, path } = setup()
  const before = store.getView()
  const secondary = before.profiles.find((profile) => profile.id !== before.assignments.main)!
  const draft = libraryDraft(secondary)
  expect(draft.instructions).toBe('Unfinished secondary')
  draft.name = ' Draft revised '
  draft.model = 'later'
  const after = store.update({ id: secondary.id, changes: libraryProfile(draft) })
  expect(after.profiles.find((profile) => profile.id === secondary.id)?.name).toBe('Draft revised')
  expect(after.assignments).toEqual(before.assignments)
  expect(connectionPreferences(after)).toEqual({ memoryRecall: 17, newsWebSearch: true })
  expect(new ConnectionStore(path, { cipher }).getView()).toEqual(after)
})

it('saves a rename with a stable UUID and all existing sampler/key values', () => {
  const { store } = setup()
  const before = store.getView()
  const draft = libraryDraft(before.profiles[0])
  expect(libraryDirty(draft, before)).toBe(false)
  draft.name = 'Renamed'
  expect(libraryDirty(draft, before)).toBe(true)
  const after = store.update({ id: draft.profileId, changes: libraryProfile(draft) })
  expect(after.assignments).toEqual(before.assignments)
  expect(store.getProfile(draft.profileId!)).toMatchObject({ topP: 0, topK: 0, allowFallbacks: false, apiKey: 'fixture-key' })
  expect(libraryDirty(libraryDraft(after.profiles[0]), after)).toBe(false)
  expect(libraryProfile(draft)).not.toHaveProperty('hasApiKey')
  expect(libraryProfile(draft)).not.toHaveProperty('apiKeyInput')
  expect(libraryProfile(draft)).not.toHaveProperty('profileId')
})

it('retains the unsaved form and exact disk bytes on a rejected endpoint/key change', () => {
  const { store, path } = setup()
  const view = store.getView()
  const draft = libraryDraft(view.profiles[0])
  draft.baseUrl = 'http://different-mock/v1'
  const bytes = readFileSync(path)
  expect(() => store.update({ id: draft.profileId, changes: libraryProfile(draft) })).toThrow()
  expect(readFileSync(path)).toEqual(bytes)
  expect(libraryDirty(draft, view)).toBe(true)
  expect(draft.baseUrl).toBe('http://different-mock/v1')
  draft.clearKey = true
  store.update({ id: draft.profileId, changes: libraryProfile(draft) })
  expect(store.getProfile(draft.profileId!).apiKey).toBe('')
})

it('duplicates saved parameters without credentials and protects assigned deletion', () => {
  const { store, path } = setup()
  const view = store.getView()
  const source = view.profiles[0]
  const next = store.duplicate({ id: source.id, name: uniqueConnectionName(view, `${source.name} copy`) })
  const copy = next.profiles.at(-1)!
  expect(copy).toMatchObject({ model: source.model, topP: 0, topK: 0, hasApiKey: false })
  expect(copy.id).not.toBe(source.id)
  expect(() => store.delete({ id: source.id })).toThrow()
  store.assign({ role: 'main', profileId: copy.id })
  store.assign({ role: 'nsfw', profileId: copy.id })
  store.delete({ id: source.id })
  expect(new ConnectionStore(path, { cipher }).getView().assignments).toEqual({ main: copy.id, nsfw: copy.id })
})

it('creates keyless connections with unique names and rejects blank or duplicate names without writing', () => {
  const { store, path } = setup()
  const before = store.getView()
  const name = before.profiles[0].name
  expect(uniqueConnectionName(before, name.toUpperCase())).toBe(`${name.toUpperCase()} 2`)
  const draft = libraryDraft(undefined, 'Local')
  expect(libraryDirty(draft, before)).toBe(true)
  const next = store.create(libraryProfile(draft))
  expect(next.profiles.at(-1)).toMatchObject({ name: 'Local', hasApiKey: false })
  const bytes = readFileSync(path)
  expect(() => store.create(libraryProfile({ ...draft, name: '   ' }))).toThrow()
  expect(() => store.create(libraryProfile({ ...draft, name: ' local ' }))).toThrow()
  expect(readFileSync(path)).toEqual(bytes)
})

it('replaces a key only when typed and keeps independent preferences out of profile writes', () => {
  const { store } = setup()
  const before = store.getView()
  const draft = libraryDraft(before.profiles[0])
  expect(libraryProfile(draft).apiKey).toBeUndefined()
  draft.apiKeyInput = 'replacement-fixture-key'
  draft.temperature = 0
  store.update({ id: draft.profileId, changes: libraryProfile(draft) })
  expect(store.getProfile(draft.profileId!)).toMatchObject({ apiKey: 'replacement-fixture-key', temperature: 0 })
  const preferences = { memoryRecall: 23, newsWebSearch: false }
  const after = store.updatePreferences(preferences)
  expect(connectionPreferences(after)).toEqual(preferences)
  expect(store.getProfile(draft.profileId!)).toMatchObject({ apiKey: 'replacement-fixture-key', temperature: 0 })
})
