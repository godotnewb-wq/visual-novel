import { IPC } from '../shared/ipc'
import type { GenerationApi, GenerationResult } from '../shared/generationConnections'

export function createGenerationBridge(invoke: (channel: string, ...args: unknown[]) => Promise<unknown>): GenerationApi {
  return { get: () => invoke(IPC.generationGet) as Promise<GenerationResult>,
    assign: (request) => invoke(IPC.generationAssign, request) as Promise<GenerationResult>,
    setMode: (request) => invoke(IPC.generationMode, request) as Promise<GenerationResult> }
}
