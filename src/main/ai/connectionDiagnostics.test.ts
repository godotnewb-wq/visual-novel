import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc'
import { ConnectionStore } from '../settings/connectionStore'
import { registerConnectionDiagnostics } from './connectionDiagnostics'
import type { chatCompletion, listModels } from './openai'

const roots: string[] = []
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'bh-diagnostics-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  const store = new ConnectionStore(path, { cipher: { encrypt: (key) => key, decrypt: (key) => key } })
  const id = store.getView().assignments.main
  store.update({ id, changes: { baseUrl: 'https://host/v1', model: 'saved', apiKey: 'saved-test-key' } })
  const models = vi.fn<typeof listModels>().mockResolvedValue(['model-a'])
  const complete = vi.fn<typeof chatCompletion>().mockResolvedValue('saved-test-key must not be echoed')
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const event = {} as IpcMainInvokeEvent
  registerConnectionDiagnostics({ handle: (channel, handler) => { handlers.set(channel, handler) } }, store, (received) => received === event, { listModels: models, chatCompletion: complete })
  return { path, store, id, models, complete, call: (channel: string, raw: unknown) => handlers.get(channel)!(event, raw), handlers }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

it('tests edited models and parameters without saving, changing roles, or echoing the reply', async () => {
  const { call, complete, path, id } = setup()
  const before = readFileSync(path)
  const result = await call(IPC.connectionsTest, { profileId: id, profile: { baseUrl: 'https://host/v1/', model: 'unsaved', temperature: 1.6, timeoutSeconds: 300, topK: 17, instructions: 'Unsaved instruction' } })
  expect(result).toEqual({ ok: true, message: 'Connected.' })
  expect(complete).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'saved-test-key', model: 'unsaved', temperature: 1.6, topK: 17, timeoutSeconds: 300 }), expect.objectContaining({ maxTokens: 16, temperature: 0 }))
  expect(readFileSync(path)).toEqual(before)
})

it('refuses to borrow saved keys for changed URLs, for both discovery and tests', async () => {
  const { call, models, complete, id } = setup()
  const listed = await call(IPC.connectionsModels, { profileId: id, baseUrl: 'https://other/v1' })
  const tested = await call(IPC.connectionsTest, { profileId: id, profile: { baseUrl: 'https://other/v1', model: 'new' } })
  expect(listed).toMatchObject({ models: [], error: expect.stringContaining('Re-enter or clear') })
  expect(tested).toMatchObject({ ok: false, message: expect.stringContaining('Re-enter or clear') })
  expect(models).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
})

it('accepts explicit replacement keys, explicit keyless requests, and new unsaved profiles', async () => {
  const { call, models, id, path } = setup()
  const before = readFileSync(path)
  for (const [profileId, apiKey] of [[id, 'typed-key'], [id, ''], [null, undefined]] as const) {
    await call(IPC.connectionsModels, { profileId, baseUrl: 'https://other/v1', apiKey })
    expect(models).toHaveBeenLastCalledWith({ baseUrl: 'https://other/v1', apiKey: apiKey ?? '' })
  }
  expect(readFileSync(path)).toEqual(before)
})

it('authorizes before reading credentials and never returns provider diagnostics', async () => {
  const { call, models, complete, id, handlers } = setup()
  const forbidden = await handlers.get(IPC.connectionsModels)!({} as IpcMainInvokeEvent, { profileId: id, baseUrl: 'https://host/v1' })
  expect(forbidden).toMatchObject({ error: expect.stringContaining('cannot manage') })
  expect(models).not.toHaveBeenCalled()
  models.mockRejectedValue(new Error('saved-test-key'))
  complete.mockRejectedValue(new Error('saved-test-key'))
  const badModels = await call(IPC.connectionsModels, { profileId: id, baseUrl: 'https://host/v1' })
  const badTest = await call(IPC.connectionsTest, { profileId: id, profile: { baseUrl: 'https://host/v1', model: 'x' } })
  expect(JSON.stringify([badModels, badTest])).not.toContain('saved-test-key')
  expect(await call(IPC.connectionsModels, { profileId: 'main', baseUrl: 'https://host/v1' })).toMatchObject({ error: 'Invalid connection settings.' })
})
