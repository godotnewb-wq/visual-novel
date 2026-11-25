import { IPC } from '../shared/ipc'
import type { ConnectionApi, ConnectionResult } from '../shared/llmConnections'

export function createConnectionBridge(invoke: (channel: string, ...args: unknown[]) => Promise<unknown>): ConnectionApi {
  const change = (channel: string, request?: unknown) => invoke(channel, request) as Promise<ConnectionResult>
  return {
    get: () => change(IPC.connectionsGet),
    create: (request) => change(IPC.connectionsCreate, request),
    update: (request) => change(IPC.connectionsUpdate, request),
    rename: (request) => change(IPC.connectionsRename, request),
    duplicate: (request) => change(IPC.connectionsDuplicate, request),
    delete: (request) => change(IPC.connectionsDelete, request),
    assign: (request) => change(IPC.connectionsAssign, request),
    updatePreferences: (request) => change(IPC.connectionsPreferences, request),
    saveRoles: (request) => change(IPC.connectionsSaveRoles, request),
    listModels: (request) => invoke(IPC.connectionsModels, request) as ReturnType<ConnectionApi['listModels']>,
    test: (request) => invoke(IPC.connectionsTest, request) as ReturnType<ConnectionApi['test']>
  }
}
