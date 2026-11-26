import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import { DualBeginSchema, DualCancelSchema, DualControlSchema, DualInvalidateSchema, DualRegenerateSchema,
  type DualBeginRequest, type DualBridgeResult } from '../../shared/dualTurnBridge'
import type { GenerationSnapshot } from '../settings/requestSnapshot'
import { isConfigured } from '../../shared/settings'
import { DualTurnService, type DualTurnRequest, type DualTurnResult } from './dualTurn'

interface Dependencies {
  allowed(event: IpcMainInvokeEvent): boolean
  contentRevision(): string
  connections(): GenerationSnapshot | null
  prepare(request: DualBeginRequest): Pick<DualTurnRequest, 'context' | 'hints'>
}
interface Active { sessionId: string; turnId: string; token: string; request: DualBeginRequest }
const configured = (snapshot: GenerationSnapshot | null) => !!snapshot?.writer && !!snapshot.manager
  && isConfigured(snapshot.writer.parameters) && isConfigured(snapshot.manager.parameters)

export function registerDualTurnIpc(ipc: Pick<IpcMain, 'handle'>, dependencies: Dependencies, service = new DualTurnService()) {
  const active = new Map<string, Active>(), watched = new Set<number>()
  const owner = (event: IpcMainInvokeEvent) => String(event.sender.id)
  const invalidateOwner = (id: string) => {
    const current = active.get(id)
    if (current) service.invalidate(id, current.sessionId)
    active.delete(id)
  }
  const watch = (event: IpcMainInvokeEvent) => {
    if (watched.has(event.sender.id)) return
    watched.add(event.sender.id)
    event.sender.on('did-start-navigation', (_event, _url, _inPlace, mainFrame) => { if (mainFrame) invalidateOwner(owner(event)) })
    event.sender.once('destroyed', () => { invalidateOwner(owner(event)); watched.delete(event.sender.id) })
  }
  const matches = (event: IpcMainInvokeEvent, request: { sessionId: string; turnId: string; token?: string }) => {
    const current = active.get(owner(event))
    return current?.sessionId === request.sessionId && current.turnId === request.turnId
      && (!request.token || current.token === request.token) ? current : undefined
  }
  const output = (event: IpcMainInvokeEvent, item: Active, result: DualTurnResult): DualBridgeResult => {
    if (active.get(owner(event)) !== item || !dependencies.allowed(event) || dependencies.contentRevision() !== item.request.contentRevision) {
      service.cancel({ ownerId: owner(event), sessionId: item.sessionId, token: item.token })
      if (active.get(owner(event)) === item) active.delete(owner(event))
      return { status: 'discarded' }
    }
    if (result.status === 'validated') return { status: 'ready', token: result.token,
      ready: { turnId: item.turnId, sceneId: item.request.scene.generation!.mode === 'dual' ? item.request.scene.generation!.sceneId : '',
        revision: item.request.revision, contentRevision: item.request.contentRevision, effects: result.effects } }
    if (result.status === 'held') return { ...result, turnId: item.turnId }
    return result
  }
  const begin = async (event: IpcMainInvokeEvent, request: DualBeginRequest): Promise<DualBridgeResult> => {
    if (request.scene.generation?.mode !== 'dual' || request.scene.generation.lastCommittedTurnId === request.turnId) return { status: 'failed', code: 'invalid-request' }
    if (request.contentRevision !== dependencies.contentRevision()) return { status: 'failed', code: 'stale' }
    const connections = dependencies.connections()
    if (!connections || !configured(connections)) return { status: 'failed', code: 'unavailable' }
    watch(event)
    const prepared = dependencies.prepare(request)
    let item!: Active
    const task = service.start({ ...prepared, ownerId: owner(event), sessionId: request.sessionId, revision: String(request.revision), connections: { ...connections, generationMode: 'dual' },
      isCurrent: () => dependencies.allowed(event) && dependencies.contentRevision() === request.contentRevision
        && (!item || active.get(owner(event)) === item) })
    item = { sessionId: request.sessionId, turnId: request.turnId, token: task.token, request }
    active.set(owner(event), item)
    return output(event, item, await task.result)
  }
  const actions: Record<string, (event: IpcMainInvokeEvent, raw: unknown) => unknown> = {
    [IPC.dualInfo]: (_event, raw) => { if (raw !== undefined) throw new Error('request'); return { contentRevision: dependencies.contentRevision(), available: configured(dependencies.connections()) } },
    [IPC.dualBegin]: (event, raw) => begin(event, DualBeginSchema.parse(raw)),
    [IPC.dualRetry]: async (event, raw) => {
      const request = DualControlSchema.parse(raw), item = matches(event, request)
      if (!item) return { status: 'discarded' }
      return output(event, item, await service.retryManager({ ownerId: owner(event), ...request }))
    },
    [IPC.dualRegenerate]: (event, raw) => {
      const request = DualRegenerateSchema.parse(raw), previous = matches(event, { sessionId: request.sessionId, turnId: request.previousTurnId, token: request.previousToken })
      if (!previous || previous.turnId === request.turnId || !service.canRegenerate({ ownerId: owner(event), sessionId: request.sessionId, token: request.previousToken })) return { status: 'discarded' }
      const { previousTurnId: _turn, previousToken: _token, ...next } = request
      return begin(event, next)
    },
    [IPC.dualCancel]: (event, raw) => {
      const request = DualCancelSchema.parse(raw), item = matches(event, request)
      if (!item) return false
      invalidateOwner(owner(event)); return true
    },
    [IPC.dualInvalidate]: (event, raw) => {
      const { sessionId } = DualInvalidateSchema.parse(raw), item = active.get(owner(event))
      if (item?.sessionId !== sessionId) return false
      invalidateOwner(owner(event)); return true
    },
    [IPC.dualAcknowledge]: (event, raw) => {
      const request = DualControlSchema.parse(raw), item = matches(event, request)
      if (!item) return false
      const acknowledged = service.acknowledge({ ownerId: owner(event), ...request })
      if (acknowledged) active.delete(owner(event))
      return acknowledged
    }
  }
  const booleanChannels: readonly string[] = [IPC.dualCancel, IPC.dualInvalidate, IPC.dualAcknowledge]
  for (const [channel, action] of Object.entries(actions)) ipc.handle(channel, async (event, raw: unknown, ...extra: unknown[]) => {
    const failure = (code: string) => booleanChannels.includes(channel) ? false : { status: 'failed', code }
    if (!dependencies.allowed(event)) return failure('forbidden')
    if (extra.length) return failure('invalid-request')
    try { return await action(event, raw) } catch (error) {
      return failure(error && typeof error === 'object' && 'issues' in error ? 'invalid-request' : 'request-failed')
    }
  })
  return { invalidateOwner }
}
