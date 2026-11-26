import { IPC } from '../shared/ipc'
import type { DualTurnApi } from '../shared/dualTurnBridge'

export function createDualTurnBridge(invoke: (channel: string, ...args: unknown[]) => Promise<unknown>): DualTurnApi {
  return {
    info: () => invoke(IPC.dualInfo) as ReturnType<DualTurnApi['info']>,
    begin: (request) => invoke(IPC.dualBegin, request) as ReturnType<DualTurnApi['begin']>,
    retry: (request) => invoke(IPC.dualRetry, request) as ReturnType<DualTurnApi['retry']>,
    regenerate: (request) => invoke(IPC.dualRegenerate, request) as ReturnType<DualTurnApi['regenerate']>,
    cancel: (request) => invoke(IPC.dualCancel, request) as Promise<boolean>,
    invalidate: (request) => invoke(IPC.dualInvalidate, request) as Promise<boolean>,
    acknowledge: (request) => invoke(IPC.dualAcknowledge, request) as Promise<boolean>
  }
}
