import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import type { ConnectionResult, ConnectionSettingsView } from '../../shared/llmConnections'
import { ConnectionStoreError } from './connectionErrors'
import type { ConnectionStore } from './connectionStore'

/** The caller authorizes the owning main frame and trusted app URL. */
export function registerConnectionIpc(
  ipc: Pick<IpcMain, 'handle'>,
  store: ConnectionStore,
  allowedSender: (event: IpcMainInvokeEvent) => boolean
): void {
  const actions: Record<string, (raw: unknown) => ConnectionSettingsView> = {
    [IPC.connectionsGet]: (raw) => {
      if (raw !== undefined) throw new ConnectionStoreError('invalid-request')
      return store.getView()
    },
    [IPC.connectionsCreate]: (raw) => store.create(raw),
    [IPC.connectionsUpdate]: (raw) => store.update(raw),
    [IPC.connectionsRename]: (raw) => store.rename(raw),
    [IPC.connectionsDuplicate]: (raw) => store.duplicate(raw),
    [IPC.connectionsDelete]: (raw) => store.delete(raw),
    [IPC.connectionsAssign]: (raw) => store.assign(raw),
    [IPC.connectionsPreferences]: (raw) => store.updatePreferences(raw),
    [IPC.connectionsSaveRoles]: (raw) => store.saveRoles(raw)
  }
  for (const [channel, action] of Object.entries(actions)) {
    ipc.handle(channel, (event, raw: unknown, ...extra: unknown[]): ConnectionResult => {
      try {
        if (!allowedSender(event)) throw new ConnectionStoreError('forbidden')
        if (extra.length > 0) throw new ConnectionStoreError('invalid-request')
        return { ok: true, settings: action(raw) }
      } catch (error) {
        const safe = new ConnectionStoreError(error instanceof ConnectionStoreError ? error.code : 'internal-error')
        return { ok: false, error: { code: safe.code, message: safe.message } }
      }
    })
  }
}
