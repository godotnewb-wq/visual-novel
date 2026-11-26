import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import type { GenerationResult, GenerationSettingsView } from '../../shared/generationConnections'
import type { ConnectionStore } from './connectionStore'
import { ConnectionStoreError } from './connectionErrors'

export function registerGenerationIpc(ipc: Pick<IpcMain, 'handle'>, store: ConnectionStore, allowed: (event: IpcMainInvokeEvent) => boolean) {
  const actions: Record<string, (raw: unknown) => GenerationSettingsView> = {
    [IPC.generationGet]: (raw) => { if (raw !== undefined) throw new ConnectionStoreError('invalid-request'); return store.getGenerationView() },
    [IPC.generationAssign]: (raw) => store.assignGeneration(raw),
    [IPC.generationMode]: (raw) => store.setGenerationMode(raw)
  }
  for (const [channel, action] of Object.entries(actions)) ipc.handle(channel, (event, raw: unknown, ...extra: unknown[]): GenerationResult => {
    try {
      if (!allowed(event)) throw new ConnectionStoreError('forbidden')
      if (extra.length) throw new ConnectionStoreError('invalid-request')
      return { ok: true, settings: action(raw) }
    } catch (error) {
      const safe = new ConnectionStoreError(error instanceof ConnectionStoreError ? error.code : 'internal-error')
      return { ok: false, error: { code: safe.code, message: safe.message } }
    }
  })
}
