import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { ConnectionStore } from './connectionStore'
import { connectionForm, formProfile } from '../../renderer/src/connectionForm'

const roots: string[] = []
function setup() {
  const root = fs.mkdtempSync(join(tmpdir(), 'bh-role-forms-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  const store = new ConnectionStore(path, { cipher: { encrypt: (key) => Buffer.from(key).toString('base64'), decrypt: (key) => Buffer.from(key, 'base64').toString() } })
  const form = connectionForm(store.getView())
  const request = () => ({ main: { profileId: form.main.profileId, profile: formProfile(form.main) }, nsfw: { profileId: form.nsfw.profileId, profile: formProfile(form.nsfw) }, memoryRecall: form.memoryRecall, newsWebSearch: form.newsWebSearch })
  return { path, store, form, request }
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

it('saves both role forms and preferences atomically and retains unassigned library profiles', () => {
  const { store, form, request, path } = setup()
  store.create({ name: 'Retained draft', instructions: 'Not assigned' })
  form.main.model = 'main'; form.main.baseUrl = 'http://main/v1'; form.main.apiKeyInput = 'main-key'
  form.nsfw.model = 'secondary'; form.nsfw.baseUrl = 'http://secondary/v1'; form.nsfw.apiKeyInput = 'secondary-key'
  form.memoryRecall = 13; form.newsWebSearch = true
  const view = store.saveRoles(request())
  expect(view.profiles.some((profile) => profile.name === 'Retained draft')).toBe(true)
  expect(view.assignments.nsfw).not.toBeNull()
  expect(store.snapshot().nsfw?.resolve().apiKey).toBe('secondary-key')
  expect(new ConnectionStore(path).getView().profiles).toHaveLength(3)
  expect(view).toMatchObject({ memoryRecall: 13, newsWebSearch: true })
})

it('keeps the whole form unchanged if one role is invalid or the write fails', () => {
  const { store, form, request, path } = setup()
  const before = fs.readFileSync(path)
  form.main.model = 'Must not persist'
  form.nsfw.temperature = 99
  expect(() => store.saveRoles(request())).toThrow('Invalid connection settings')
  expect(fs.readFileSync(path)).toEqual(before)
  expect(store.getView().profiles[0].model).toBe('')
  form.nsfw.temperature = 0.8
  const files = { ...fs, renameSync: () => { throw new Error('write failure') } }
  const failing = new ConnectionStore(path, { files })
  expect(() => failing.saveRoles(request())).toThrow('previous settings were kept')
  expect(fs.readFileSync(path)).toEqual(before)
})

it('rejects stale role references and conflicting edits of a profile shared by both roles', () => {
  const { store, request, path } = setup()
  const main = store.getView().assignments.main
  store.assign({ role: 'nsfw', profileId: main })
  expect(() => store.saveRoles(request())).toThrow('changed on disk')
  const form = connectionForm(store.getView())
  const before = fs.readFileSync(path)
  expect(() => store.saveRoles({ main: { profileId: main, profile: { ...formProfile(form.main), model: 'a' } }, nsfw: { profileId: main, profile: { ...formProfile(form.nsfw), model: 'b' } }, memoryRecall: 8, newsWebSearch: false })).toThrow()
  expect(fs.readFileSync(path)).toEqual(before)
})

it('requires explicit credential consent when changing a stored endpoint', () => {
  const { store } = setup()
  const id = store.getView().assignments.main
  store.update({ id, changes: { baseUrl: 'https://host/v1', apiKey: 'saved-key' } })
  expect(() => store.update({ id, changes: { baseUrl: 'https://other/v1' } })).toThrow('Re-enter or clear')
  store.update({ id, changes: { baseUrl: 'https://HOST:443/v1/' } })
  expect(store.getProfile(id).apiKey).toBe('saved-key')
  store.update({ id, changes: { baseUrl: 'https://other/v1', apiKey: '' } })
  expect(store.getProfile(id).apiKey).toBe('')
})
