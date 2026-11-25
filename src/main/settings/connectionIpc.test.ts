import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc'
import { ConnectionResultSchema } from '../../shared/llmConnections'
import { createConnectionBridge } from '../../preload/connections'
import { ConnectionStore } from './connectionStore'
import { registerConnectionIpc } from './connectionIpc'
import { ConnectionStoreError } from './connectionErrors'

const roots: string[] = []
const secret = 'test-only-ipc-key'
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'bh-connection-ipc-'))
  roots.push(root)
  const path = join(root, 'settings.json')
  const store = new ConnectionStore(path, { cipher: {
    encrypt: (key) => Buffer.from(key).toString('base64'), decrypt: (stored) => Buffer.from(stored, 'base64').toString()
  } })
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const event = { sender: { id: 42 }, senderFrame: { routingId: 1 } } as IpcMainInvokeEvent
  registerConnectionIpc({ handle: (channel, handler) => { handlers.set(channel, handler) } }, store,
    (received) => received.sender === event.sender && received.senderFrame === event.senderFrame)
  const invoke = async (channel: string, ...args: unknown[]) => ConnectionResultSchema.parse(await handlers.get(channel)!(event, ...structuredClone(args)))
  return { path, store, handlers, event, api: createConnectionBridge(invoke) }
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('connection IPC and preload bridge', () => {
  it('supports all operations through the typed bridge without exposing stored credentials', async () => {
    const { api, path } = setup()
    const initial = await api.get()
    expect(initial.ok).toBe(true)
    if (!initial.ok) return
    let result = await api.create({ name: 'Hosted', baseUrl: 'http://host/v1', model: 'a', apiKey: secret })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const id = result.settings.profiles.find((profile) => profile.name === 'Hosted')!.id
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain(Buffer.from(secret).toString('base64'))
    expect(JSON.stringify(result)).not.toContain('"apiKey"')
    expect(JSON.stringify(result)).not.toContain('apiKeyEncrypted')
    result = await api.update({ id, changes: { model: 'b' } })
    expect(result.ok && result.settings.profiles.find((profile) => profile.id === id)?.model).toBe('b')
    result = await api.rename({ id, name: 'Renamed' })
    expect(result.ok && result.settings.profiles.some((profile) => profile.id === id && profile.name === 'Renamed')).toBe(true)
    result = await api.duplicate({ id, name: 'Copy' })
    expect(result.ok && result.settings.profiles.find((profile) => profile.name === 'Copy')?.hasApiKey).toBe(false)
    expect((await api.assign({ role: 'main', profileId: id })).ok).toBe(true)
    expect((await api.assign({ role: 'nsfw', profileId: null })).ok).toBe(true)
    expect((await api.updatePreferences({ memoryRecall: 12, newsWebSearch: true })).ok).toBe(true)
    expect((await api.delete({ id: initial.settings.assignments.main })).ok).toBe(true)
    expect(new ConnectionStore(path).getView()).toMatchObject({ memoryRecall: 12, newsWebSearch: true, assignments: { main: id } })
    expect(readFileSync(path, 'utf8')).not.toContain(secret)
  })

  it('requires an authorized sender before validating or reading settings', () => {
    const { store, handlers, event } = setup()
    const read = vi.spyOn(store, 'getView')
    for (const handler of handlers.values()) {
      const result = handler({ sender: { id: 7 } } as IpcMainInvokeEvent, { apiKey: secret })
      expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } })
      expect(JSON.stringify(result)).not.toContain(secret)
    }
    expect(read).not.toHaveBeenCalled()
    expect(handlers.get(IPC.connectionsGet)!({ ...event, senderFrame: {} } as IpcMainInvokeEvent)).toMatchObject({ ok: false, error: { code: 'forbidden' } })
  })

  it('rejects malformed and extra arguments without writing or echoing input', () => {
    const { handlers, event, path } = setup()
    const before = readFileSync(path)
    const calls: [string, unknown[]][] = [
      [IPC.connectionsGet, [{ apiKey: secret }]],
      [IPC.connectionsCreate, [{ name: 'X', hasApiKey: secret }]],
      [IPC.connectionsUpdate, [{ id: secret, changes: {} }]],
      [IPC.connectionsRename, [null]],
      [IPC.connectionsDuplicate, [{ id: secret, name: 'Copy' }]],
      [IPC.connectionsDelete, [secret]],
      [IPC.connectionsAssign, [{ role: 'writer', profileId: null }]],
      [IPC.connectionsPreferences, [{ apiKey: secret }]],
      [IPC.connectionsGet, [undefined, secret]]
    ]
    for (const [channel, args] of calls) {
      const result = ConnectionResultSchema.parse(handlers.get(channel)!(event, ...args))
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
      expect(JSON.stringify(result)).not.toContain(secret)
    }
    expect(readFileSync(path)).toEqual(before)
  })

  it('returns only fixed messages even when internal or typed exceptions contain secrets', async () => {
    const { store, api } = setup()
    vi.spyOn(store, 'getView').mockImplementationOnce(() => { throw new Error(secret) })
    expect(await api.get()).toMatchObject({ ok: false, error: { code: 'internal-error' } })
    const typed = new ConnectionStoreError('write-failed')
    typed.message = secret
    vi.spyOn(store, 'getView').mockImplementationOnce(() => { throw typed })
    const result = await api.get()
    expect(result).toMatchObject({ ok: false, error: { code: 'write-failed' } })
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
