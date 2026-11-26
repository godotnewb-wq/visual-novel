import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConnectionStore } from './connectionStore'
import { registerGenerationIpc } from './generationIpc'
import { createGenerationBridge } from '../../preload/generation'
import { GenerationResultSchema, type GenerationResult } from '../../shared/generationConnections'
import { IPC } from '../../shared/ipc'
import type { ConnectionFiles } from './connectionFiles'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
function setup(files?: ConnectionFiles) {
  const root = mkdtempSync(join(tmpdir(), 'bh-generation-ipc-')); roots.push(root)
  const path = join(root, 'settings.json'), previous = new ConnectionStore(path)
  previous.create({ name: 'Storyteller', baseUrl: 'http://writer/v1', model: 'writer' })
  previous.create({ name: 'Rules', baseUrl: 'http://manager/v1', model: 'manager' })
  const original = readFileSync(path)
  const store = new ConnectionStore(path, { generation: true, files })
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const event = { sender: { id: 1 }, senderFrame: { routingId: 1 } } as IpcMainInvokeEvent
  registerGenerationIpc({ handle: (name, handler) => { handlers.set(name, handler) } }, store, (candidate) => candidate === event)
  const api = createGenerationBridge(async (name, ...args) => handlers.get(name)!(event, ...args))
  const profiles = store.getView().profiles
  return { root, path, original, store, event, handlers, api, writer: profiles.find((profile) => profile.name === 'Storyteller')!.id, manager: profiles.find((profile) => profile.name === 'Rules')!.id }
}
function value(result: GenerationResult) { expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.error.message); return result.settings }

describe('generation settings and authorized controls', () => {
  it('migrates exact v2 bytes once, preserves Main/NSFW and defaults existing installations to Legacy', async () => {
    const run = setup(), view = value(await run.api.get())
    expect(view).toMatchObject({ settingsVersion: 3, generationMode: 'legacy', assignments: { writer: null, manager: null } })
    expect(readFileSync(run.store.migrationBackupPath!)).toEqual(run.original)
    expect(new ConnectionStore(run.path, { generation: true }).getGenerationView()).toEqual(view)
    expect(readdirSync(run.root).filter((name) => name.includes('.pre-v3-'))).toHaveLength(1)
  })
  it('enables Dual only after both roles are assigned, with independent saved identities', async () => {
    const run = setup(), oldMain = run.store.getView().assignments.main
    expect((await run.api.setMode({ generationMode: 'dual' })).ok).toBe(false)
    value(await run.api.assign({ role: 'writer', profileId: run.writer }))
    expect((await run.api.setMode({ generationMode: 'dual' })).ok).toBe(false)
    value(await run.api.assign({ role: 'manager', profileId: run.manager }))
    expect(value(await run.api.setMode({ generationMode: 'dual' })).assignments).toMatchObject({ main: oldMain, writer: run.writer, manager: run.manager })
    expect(new ConnectionStore(run.path, { generation: true }).getGenerationView().generationMode).toBe('dual')
  })
  it('permits one configured connection for both roles and keeps mode changes out of existing snapshots', async () => {
    const run = setup()
    value(await run.api.assign({ role: 'writer', profileId: run.writer })); value(await run.api.assign({ role: 'manager', profileId: run.writer }))
    value(await run.api.setMode({ generationMode: 'dual' }))
    const captured = run.store.generationSnapshot()
    value(await run.api.setMode({ generationMode: 'legacy' }))
    expect(captured.generationMode).toBe('dual'); expect(captured.manager!.id).toBe(run.writer)
    expect(run.store.generationSnapshot().generationMode).toBe('legacy')
  })
  it('rejects clearing a required role or deleting its profile, with no silent Main fallback', async () => {
    const run = setup()
    value(await run.api.assign({ role: 'writer', profileId: run.writer })); value(await run.api.assign({ role: 'manager', profileId: run.manager }))
    value(await run.api.setMode({ generationMode: 'dual' }))
    const bytes = readFileSync(run.path)
    expect((await run.api.assign({ role: 'writer', profileId: null })).ok).toBe(false)
    expect(() => run.store.delete({ id: run.writer })).toThrow()
    expect(readFileSync(run.path)).toEqual(bytes)
    value(await run.api.setMode({ generationMode: 'legacy' }))
    value(await run.api.assign({ role: 'writer', profileId: null }))
    run.store.delete({ id: run.writer })
  })
  it('rejects unconfigured roles at mode enablement and keeps a failed mode write atomic', async () => {
    const files: ConnectionFiles = { ...fs, renameSync: vi.fn(fs.renameSync) }, run = setup(files)
    value(await run.api.assign({ role: 'writer', profileId: run.store.getView().assignments.main }))
    value(await run.api.assign({ role: 'manager', profileId: run.manager }))
    expect((await run.api.setMode({ generationMode: 'dual' })).ok).toBe(false)
    value(await run.api.assign({ role: 'writer', profileId: run.writer }))
    const before = readFileSync(run.path)
    vi.mocked(files.renameSync).mockImplementationOnce(() => { throw new Error('Write failure') })
    expect((await run.api.setMode({ generationMode: 'dual' })).ok).toBe(false)
    expect(readFileSync(run.path)).toEqual(before); expect(run.store.getGenerationView().generationMode).toBe('legacy')
  })
  it.each([IPC.generationGet, IPC.generationAssign, IPC.generationMode])('rejects a foreign sender before reading or writing: %s', async (channel) => {
    const run = setup(), before = readFileSync(run.path)
    const result = GenerationResultSchema.parse(await run.handlers.get(channel)!({} as IpcMainInvokeEvent, { generationMode: 'dual' }))
    expect(result).toMatchObject({ ok: false, error: { code: 'forbidden' } }); expect(readFileSync(run.path)).toEqual(before)
  })
  it('rejects unknown fields/roles/IDs and extra arguments without losing settings', async () => {
    const run = setup(), before = readFileSync(run.path)
    for (const [channel, request] of [[IPC.generationMode, { generationMode: 'dual', apiKey: 'not-allowed' }],
      [IPC.generationAssign, { role: 'main', profileId: run.writer }], [IPC.generationAssign, { role: 'writer', profileId: 'bad' }], [IPC.generationGet, {}]] as const) {
      expect(GenerationResultSchema.parse(await run.handlers.get(channel)!(run.event, request))).toMatchObject({ ok: false })
    }
    expect(await run.handlers.get(IPC.generationGet)!(run.event, undefined, 'extra')).toMatchObject({ ok: false })
    expect(readFileSync(run.path)).toEqual(before)
  })
})
