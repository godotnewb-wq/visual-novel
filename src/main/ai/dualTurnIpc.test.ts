import { EventEmitter } from 'node:events'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/ipc'
import { LlmProfileSchema } from '../../shared/settings'
import type { DualBeginRequest, DualBridgeResult } from '../../shared/dualTurnBridge'
import { fixture } from '../../shared/game/testFixture'
import { createInitialState } from '../../shared/game/state'
import { sceneBaseline } from '../../shared/game/scene'
import { createGameSession, prepareDualCheckpoint, reduceGameSession, saveGameSession } from '../../shared/game/dualSession'
import { dualSceneSources } from '../../shared/game/dualSources'
import { SaveDataSchema } from '../../shared/saves'
import { createDualTurnBridge } from '../../preload/dualTurn'
import { trustedConnectionSender } from '../settings/trustedSender'
import type { CapturedConnection, GenerationSnapshot } from '../settings/requestSnapshot'
import { DualTurnService } from './dualTurn'
import { registerDualTurnIpc } from './dualTurnIpc'
import { singleCompletion } from './singleCompletion'

const sessionId = '11111111-1111-4111-8111-111111111111', turnId = '22222222-2222-4222-8222-222222222222', nextTurnId = '33333333-3333-4333-8333-333333333333'
function captured(id: string): CapturedConnection {
  const profile = LlmProfileSchema.parse({ baseUrl: `http://${id}/v1`, apiKey: 'fixture-private-key', model: id })
  return { id, parameters: profile, resolve: () => ({ ...profile }) }
}
function envelope(id: string) { return JSON.stringify({ schemaVersion: 1, turnId: id, evidence: [], operations: [], presentation: [], comfort: [], information: [], review: [] }) }
function setup(complete = vi.fn<typeof singleCompletion>().mockImplementation(async (profile, input) => ({
  content: profile.model === 'manager' ? envelope(JSON.parse(input.messages[0].content).turnId) : 'Ana: Hello there.'
}))) {
  const content = fixture(), state = createInitialState(content)
  let session = createGameSession({ state, scene: { loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false, messages: [],
    gifts: [], conceived: [], departed: [], beats: [{ activityName: 'Talk' }], baseline: sceneBaseline(state, 'ana', []),
    generation: { schemaVersion: 1, mode: 'dual', sceneId: sessionId, nextTurnOrdinal: 1, lastCommittedTurnId: null,
      ledger: { entries: [], trackingLimited: false, droppedCandidates: 0 }, completion: { kind: 'continue' } } } })
  const pending = prepareDualCheckpoint(content, session, turnId, 'content:1', { text: 'Hello.' })
  session = reduceGameSession(session, { type: 'begin', pending })
  const request: DualBeginRequest = { sessionId, turnId, revision: session.revision, contentRevision: 'content:1', state: pending.state, scene: pending.asked }
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const frame = { url: 'file:///app/index.html' }
  const sender = Object.assign(new EventEmitter(), { id: 17, mainFrame: frame, isDestroyed: () => false })
  const event = { sender, senderFrame: frame } as unknown as IpcMainInvokeEvent
  const settings: GenerationSnapshot = { main: captured('main'), nsfw: captured('nsfw'), writer: captured('writer'), manager: captured('manager'),
    language: 'en', languageInstruction: 'English', generationMode: 'dual', memoryRecall: 8, newsWebSearch: false }
  const configuration = { available: true, revision: 'content:1' }
  const service = new DualTurnService(complete)
  const prepare = vi.fn((request: DualBeginRequest) => {
    const context = { turnId: request.turnId, content, state: request.state, scene: request.scene }
    return { context: { ...context, sources: dualSceneSources(context) } }
  })
  registerDualTurnIpc({ handle: (channel, handler) => { handlers.set(channel, handler) } }, {
    allowed: (event) => trustedConnectionSender(event, sender as unknown as WebContents, frame.url),
    connections: () => configuration.available ? settings : null,
    contentRevision: () => configuration.revision, prepare
  }, service)
  const api = createDualTurnBridge(async (channel, ...args) => handlers.get(channel)!(event, ...args))
  return { content, session, request, event, sender, handlers, api, complete, configuration, prepare, settings }
}
function ready(result: DualBridgeResult) {
  expect(result.status).toBe('ready')
  if (result.status !== 'ready') throw new Error(JSON.stringify(result))
  return result
}

describe('owning-frame Dual bridge and complete-turn pipeline', () => {
  it('crosses preload, IPC, generation, atomic commit, save parse, and undo without exposing Manager internals', async () => {
    const run = setup(), before = saveGameSession(run.session), result = ready(await run.api.begin(run.request))
    expect(run.complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'manager'])
    expect('manager' in result).toBe(false); expect(JSON.stringify(result)).not.toContain('fixture-private-key')
    expect(saveGameSession(run.session)).toEqual(before)
    const committed = reduceGameSession(run.session, { type: 'commit', content: run.content, ready: result.ready })
    const restored = createGameSession(SaveDataSchema.parse(JSON.parse(JSON.stringify(saveGameSession(committed)))))
    expect(restored.scene!.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(restored.turns[0].scene.messages).toEqual([])
    expect(reduceGameSession(committed, { type: 'commit', content: run.content, ready: result.ready })).toBe(committed)
    const control = { sessionId, turnId, token: result.token }
    expect(await run.api.acknowledge(control)).toBe(true); expect(await run.api.acknowledge(control)).toBe(false)
  })
  it('leaves normal unavailable startup without a provider request or preparation', async () => {
    const run = setup(); run.configuration.available = false
    expect(await run.api.info()).toEqual({ available: false, contentRevision: 'content:1' })
    expect(await run.api.begin(run.request)).toEqual({ status: 'failed', code: 'unavailable' })
    expect(run.complete).not.toHaveBeenCalled(); expect(run.prepare).not.toHaveBeenCalled()
  })
  it.each(['sender', 'senderFrame'] as const)('rejects a foreign %s before reading settings or preparing content', async (field) => {
    const run = setup(), foreign = { ...run.event, [field]: field === 'sender' ? { id: 99 } : { url: 'file:///app/index.html' } } as IpcMainInvokeEvent
    expect(await run.handlers.get(IPC.dualBegin)!(foreign, run.request)).toEqual({ status: 'failed', code: 'forbidden' })
    expect(await run.handlers.get(IPC.dualCancel)!(foreign, { sessionId, turnId })).toBe(false)
    expect(run.prepare).not.toHaveBeenCalled(); expect(run.complete).not.toHaveBeenCalled()
  })
  it('rejects malformed/extra fields, extra IPC arguments, and stale content without spending calls', async () => {
    const run = setup()
    expect(await run.handlers.get(IPC.dualBegin)!(run.event, { ...run.request, apiKey: 'injected' })).toMatchObject({ code: 'invalid-request' })
    expect(await run.handlers.get(IPC.dualBegin)!(run.event, run.request, 'extra')).toMatchObject({ code: 'invalid-request' })
    expect(await run.api.begin({ ...run.request, contentRevision: 'old' })).toMatchObject({ code: 'stale' })
    expect(await run.api.begin({ ...run.request, scene: { ...run.request.scene, generation: undefined } })).toMatchObject({ code: 'invalid-request' })
    expect(run.complete).not.toHaveBeenCalled()
  })
  it('holds failed Manager output privately; manual retry adds one Manager call and no Writer call', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: 'Ana: Hidden unpublished reply.' }).mockResolvedValue({ content: 'private malformed manager payload' })
    const run = setup(complete), held = await run.api.begin(run.request)
    expect(held).toMatchObject({ status: 'held', role: 'manager', actions: ['retryManager', 'cancel'] })
    expect(JSON.stringify(held)).not.toContain('unpublished'); expect(JSON.stringify(held)).not.toContain('private')
    if (held.status !== 'held') throw new Error('Expected hold')
    complete.mockResolvedValueOnce({ content: envelope(turnId) })
    ready(await run.api.retry({ sessionId, turnId, token: held.token }))
    expect(complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'manager', 'manager', 'manager'])
  })
  it('holds unsupported consequential prose after bounded review even when Manager returns empty collections', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockImplementation(async (profile, input) => ({ content: profile.model === 'manager'
      ? envelope(JSON.parse(input.messages[0].content).turnId) : '*Ana leads you into the shop.*' }))
    const run = setup(complete), held = await run.api.begin(run.request)
    expect(held).toMatchObject({ status: 'held', actions: ['regenerate', 'cancel'], issues: [{ code: 'conflict' }] })
    expect(complete).toHaveBeenCalledTimes(3); expect(saveGameSession(run.session).scene!.messages).toEqual([])
    if (held.status !== 'held') throw new Error('Expected hold')
    expect(await run.api.retry({ sessionId, turnId, token: held.token })).toMatchObject({ status: 'failed' })
    complete.mockImplementation(async (profile, input) => ({ content: profile.model === 'manager' ? envelope(JSON.parse(input.messages[0].content).turnId) : 'Ana: We could visit the shop.' }))
    const result = ready(await run.api.regenerate({ ...run.request, turnId: nextTurnId, previousTurnId: turnId, previousToken: held.token }))
    expect(result.ready.turnId).toBe(nextTurnId); expect(complete).toHaveBeenCalledTimes(5)
    expect(await run.api.cancel({ sessionId, turnId })).toBe(false)
  })
  it('does not allow regeneration of a Manager retry hold, or a completed candidate', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: 'Ana: Hello.' }).mockResolvedValue({ content: 'bad' })
    const run = setup(complete), held = await run.api.begin(run.request)
    if (held.status !== 'held') throw new Error('Expected hold')
    expect(await run.api.regenerate({ ...run.request, turnId: nextTurnId, previousTurnId: turnId, previousToken: held.token })).toMatchObject({ status: 'discarded' })
    expect(complete).toHaveBeenCalledTimes(3)
  })
  it.each(['writer', 'manager'])('cancels while %s runs and ignores a transport that resolves after abort', async (phase) => {
    let release!: (reply: { content: string }) => void
    const complete = vi.fn<typeof singleCompletion>()
    if (phase === 'manager') complete.mockResolvedValueOnce({ content: 'Ana: Hello.' })
    complete.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const run = setup(complete), result = run.api.begin(run.request)
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(phase === 'writer' ? 1 : 2))
    expect(await run.api.cancel({ sessionId, turnId })).toBe(true)
    release({ content: phase === 'writer' ? 'Ana: Late reply.' : envelope(turnId) })
    expect(await result).toMatchObject({ status: 'discarded' })
    expect(complete).toHaveBeenCalledTimes(phase === 'writer' ? 1 : 2)
  })
  it.each(['navigation', 'destroyed', 'content'])('rejects late completion after %s invalidation', async (kind) => {
    let release!: (reply: { content: string }) => void
    const complete = vi.fn<typeof singleCompletion>().mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const run = setup(complete), result = run.api.begin(run.request)
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
    if (kind === 'navigation') run.sender.emit('did-start-navigation', {}, 'file:///app/index.html', false, true)
    else if (kind === 'destroyed') run.sender.emit('destroyed')
    else run.configuration.revision = 'content:2'
    release({ content: 'Ana: Late reply.' })
    expect(await result).toMatchObject({ status: 'discarded' }); expect(complete).toHaveBeenCalledTimes(1)
  })
  it('does not let an old session cancel a replacement session in the same frame', async () => {
    const run = setup(), result = ready(await run.api.begin(run.request))
    const next = { ...run.request, sessionId: nextTurnId, turnId: nextTurnId }
    ready(await run.api.begin(next))
    expect(await run.api.invalidate({ sessionId })).toBe(false)
    expect(await run.api.acknowledge({ sessionId, turnId, token: result.token })).toBe(false)
    expect(await run.api.cancel({ sessionId: nextTurnId, turnId: nextTurnId })).toBe(true)
  })
  it('continues a captured Dual scene after the next-scene preference switches to Legacy', async () => {
    const run = setup()
    Object.assign(run.settings, { generationMode: 'legacy' })
    ready(await run.api.begin(run.request))
    expect(run.complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'manager'])
    expect(run.settings.generationMode).toBe('legacy')
  })
  it('uses the actual tool-free HTTP serializer through the bridge', async () => {
    const requests: Record<string, unknown>[] = []
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string); requests.push(body)
      const content = body.model === 'manager' ? envelope(JSON.parse(body.messages[1].content).turnId) : 'Ana: Hello.'
      return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }))
    })
    const complete = vi.fn<typeof singleCompletion>().mockImplementation((profile, input) => singleCompletion(profile, input, fetcher))
    const run = setup(complete); ready(await run.api.begin(run.request))
    expect(requests.map((request) => request.model)).toEqual(['writer', 'manager'])
    expect(requests.every((request) => request.tools === undefined)).toBe(true)
  })
})
