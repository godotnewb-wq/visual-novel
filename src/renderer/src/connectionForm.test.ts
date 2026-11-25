import { expect, it } from 'vitest'
import { ConnectionSettingsViewSchema } from '../../shared/llmConnections'
import { assignedConnection, changeConnectionForm, connectionForm, formProfile } from './connectionForm'

const main = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondary = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const view = () => ConnectionSettingsViewSchema.parse({ settingsVersion: 2, profiles: [
  { id: main, name: 'Primary', baseUrl: 'http://main/v1', model: 'm', hasApiKey: true, topK: 0 },
  { id: secondary, name: 'Secondary', baseUrl: 'http://secondary/v1', model: 'n', hasApiKey: false }
], assignments: { main, nsfw: secondary }, encryptionAvailable: true })

it('maps UUID references to the existing role forms without inserting secret or library metadata', () => {
  const form = connectionForm(view())
  expect(form.main).toMatchObject({ profileId: main, model: 'm', hasApiKey: true, apiKeyInput: '', topK: 0 })
  expect(formProfile(form.main)).not.toHaveProperty('profileId')
  expect(formProfile(form.main)).not.toHaveProperty('name')
  expect(formProfile(form.main).apiKey).toBeUndefined()
  expect(formProfile({ ...form.main, clearKey: true }).apiKey).toBe('')
})

it('keeps both forms consistent when both roles reference one profile', () => {
  const shared = view()
  shared.assignments.nsfw = main
  const updated = changeConnectionForm(connectionForm(shared), 'main', { model: 'changed', apiKeyInput: 'typed-key' })
  expect(updated.nsfw.model).toBe('changed')
  expect(updated.nsfw.apiKeyInput).toBe('typed-key')
})

it('preserves the main fallback when secondary is absent or unconfigured', () => {
  const settings = view()
  expect(assignedConnection(settings, true)?.id).toBe(secondary)
  settings.profiles[1].model = ''
  expect(assignedConnection(settings, true)?.id).toBe(main)
  settings.assignments.nsfw = null
  expect(connectionForm(settings).nsfw.profileId).toBeNull()
  expect(assignedConnection(settings, true)?.id).toBe(main)
})
