import { describe, expect, it, vi } from 'vitest'
import { LlmProfileSchema } from '../../shared/settings'
import { fixture } from '../../shared/game/testFixture'
import { createInitialState } from '../../shared/game/state'
import { sceneBaseline } from '../../shared/game/scene'
import type { Scene } from '../../shared/model'
import type { CapturedConnection } from '../settings/requestSnapshot'
import { DualTurnService, type DualTurnRequest, type DualTurnResult } from './dualTurn'
import { RefusalError } from './openai'
import { singleCompletion, SingleCompletionError } from './singleCompletion'

const turnId = '11111111-1111-4111-8111-111111111111', nextTurnId = '22222222-2222-4222-8222-222222222222'
function connection(id: string): CapturedConnection {
  const profile = LlmProfileSchema.parse({ baseUrl: `http://${id}/v1`, model: id, apiKey: `key-${id}`, instructions: `Instructions for ${id}`, topP: 0 })
  return { id, parameters: profile, resolve: () => ({ ...profile }) }
}
function request(): DualTurnRequest {
  const content = fixture(), state = createInitialState(content)
  const scene: Scene = { loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false, messages: [{ role: 'user', content: 'Hello.' }],
    beats: [{ activityName: 'Talk' }], gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana', []) }
  return { ownerId: 'window-a', sessionId: 'scene-a', revision: 'state/content:1', isCurrent: () => true,
    context: { turnId, content, state, scene, sources: [{ id: 'player', kind: 'player', currentTurn: true, text: 'Hello.', speaker: { kind: 'player' }, witnessIds: ['ana'] }] },
    connections: { main: connection('main'), nsfw: connection('nsfw'), writer: connection('writer'), manager: connection('manager'),
      language: 'en', languageInstruction: 'Write in English.', memoryRecall: 8, newsWebSearch: false, generationMode: 'dual' } }
}
const empty = (id = turnId) => JSON.stringify({ schemaVersion: 1, turnId: id, evidence: [], operations: [], presentation: [], comfort: [], information: [], review: [] })
const writerReply = 'Ana: Hello there.\n*She smiles.*'
const successful = () => vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: empty() })
const identity = (result: { token: string }) => ({ ownerId: 'window-a', sessionId: 'scene-a', token: result.token })
const validated = (result: DualTurnResult) => { expect(result.status).toBe('validated'); if (result.status !== 'validated') throw new Error(JSON.stringify(result)); return result }

describe('dormant two-call service', () => {
  it('calls Writer then Manager using independent profiles and leaves state unchanged', async () => {
    const raw = request(), before = structuredClone(raw.context), complete = successful(), service = new DualTurnService(complete)
    const result = validated(await service.begin(raw))
    expect(complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'manager'])
    expect(complete.mock.calls[1][1].messages[0].content).toContain('writer:0')
    expect(result).toMatchObject({ writer: { text: writerReply }, writerProfileId: 'writer', managerProfileId: 'manager', writerUsedNsfw: false,
      attempts: { writer: 1, manager: 1 }, manager: { requiresConsistencyReview: true } })
    expect(raw.context).toEqual(before)
    expect(service.acknowledge(identity(result))).toBe(true)
    expect(service.acknowledge(identity(result))).toBe(false)
  })
  it('permits shared profiles without crossing roles or enabling native output implicitly', async () => {
    const raw = request(); raw.connections = { ...raw.connections, manager: raw.connections.writer }
    const complete = successful()
    validated(await new DualTurnService(complete).begin(raw))
    expect(complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'writer'])
    expect(complete.mock.calls[1][1].responseFormat).toBeUndefined()
  })
  it.each([true, false])('uses only NSFW for flagged scenes or Writer refusal fallback (flagged=%s)', async (flagged) => {
    const raw = request(); raw.context.scene.nsfw = flagged
    const complete = vi.fn<typeof singleCompletion>()
    if (!flagged) complete.mockRejectedValueOnce(new RefusalError('Refusal'))
    complete.mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: empty() })
    const result = validated(await new DualTurnService(complete).begin(raw))
    expect(result.writerProfileId).toBe('nsfw'); expect(result.managerProfileId).toBe('manager'); expect(result.writerUsedNsfw).toBe(true)
    expect(complete.mock.calls.map(([profile]) => profile.model)).toEqual(flagged ? ['nsfw', 'manager'] : ['writer', 'nsfw', 'manager'])
  })
  it('uses NSFW on prose refusal, but never on Writer transport failure', async () => {
    const fallback = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: "I cannot continue this story." }).mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: empty() })
    validated(await new DualTurnService(fallback).begin(request()))
    expect(fallback.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'nsfw', 'manager'])
    const failed = vi.fn<typeof singleCompletion>().mockRejectedValue(new Error('Network'))
    expect(await new DualTurnService(failed).begin(request())).toMatchObject({ status: 'held', role: 'writer', actions: ['regenerate', 'cancel'] })
    expect(failed).toHaveBeenCalledTimes(1)
  })
  it('keeps unused unavailable NSFW credentials from blocking normal generation', async () => {
    const raw = request(); raw.connections = { ...raw.connections, nsfw: { ...connection('nsfw'), resolve() { throw new Error('Cannot decrypt') } } }
    validated(await new DualTurnService(successful()).begin(raw))
  })
  it('checks both assigned roles before spending a Writer call', async () => {
    const raw = request(); raw.connections = { ...raw.connections, manager: null }
    const complete = successful()
    await expect(new DualTurnService(complete).begin(raw)).rejects.toThrow('profile-required')
    expect(complete).not.toHaveBeenCalled()
  })
  it('holds control leakage before asking Manager and preserves ordinary bracketed prose', async () => {
    const failed = vi.fn<typeof singleCompletion>().mockResolvedValue({ content: 'Hello.\n{move_scene: shop}' })
    const result = await new DualTurnService(failed).begin(request())
    expect(result).toMatchObject({ status: 'held', role: 'writer', issues: [{ code: 'writer-control' }] })
    expect(failed).toHaveBeenCalledTimes(1)
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: '[A note] {a keepsake}' }).mockResolvedValue({ content: empty() })
    expect(validated(await new DualTurnService(complete).begin(request())).writer.text).toBe('[A note] {a keepsake}')
  })
  it('retries Manager once automatically, then one request per explicit retry with the same hidden Writer', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: 'bad manager JSON private-key' })
    const service = new DualTurnService(complete), held = await service.begin(request())
    expect(held).toMatchObject({ status: 'held', role: 'manager', actions: ['retryManager', 'cancel'] })
    expect(complete).toHaveBeenCalledTimes(3)
    expect(JSON.stringify(held)).not.toContain('Hello there'); expect(JSON.stringify(held)).not.toContain('private-key')
    expect(await service.retryManager(identity(held))).toMatchObject({ status: 'held' })
    expect(complete).toHaveBeenCalledTimes(4)
    expect(complete.mock.calls[1][1].messages).toEqual(complete.mock.calls[3][1].messages)
    complete.mockResolvedValueOnce({ content: empty() })
    const result = validated(await service.retryManager(identity(held)))
    expect(result.attempts).toEqual({ writer: 1, manager: 4 })
    expect(complete.mock.calls.filter(([profile]) => profile.model === 'writer')).toHaveLength(1)
    await expect(service.retryManager(identity(result))).rejects.toThrow('retry-unavailable')
  })
  it('does not route Manager refusal to NSFW or expose provider diagnostics', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockRejectedValue(new RefusalError('key-manager secret'))
    const result = await new DualTurnService(complete).begin(request())
    expect(result).toMatchObject({ status: 'held', role: 'manager', failure: 'refused' })
    expect(complete.mock.calls.map(([profile]) => profile.model)).toEqual(['writer', 'manager', 'manager'])
    expect(JSON.stringify(result)).not.toContain('key-manager')
  })
  it('counts structured-output downgrade inside the two-attempt Manager budget', async () => {
    const raw = request(); raw.nativeSchema = { profileId: 'manager', baseUrl: 'http://manager/v1', model: 'manager', verified: true }
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply })
      .mockRejectedValueOnce(new SingleCompletionError('format-unsupported')).mockResolvedValueOnce({ content: 'bad JSON' }).mockResolvedValue({ content: empty() })
    const service = new DualTurnService(complete), held = await service.begin(raw)
    expect(held.status).toBe('held'); expect(complete).toHaveBeenCalledTimes(3)
    expect(complete.mock.calls[1][1].responseFormat?.type).toBe('json_schema')
    expect(complete.mock.calls[2][1].responseFormat).toBeUndefined()
    validated(await service.retryManager(identity(held)))
    expect(complete.mock.calls[3][1].responseFormat).toBeUndefined()
  })
  it.each(['profileId', 'baseUrl', 'model'] as const)('discards a capability after its %s changes', async (field) => {
    const raw = request(); raw.nativeSchema = { profileId: 'manager', baseUrl: 'http://manager/v1', model: 'manager', verified: true, [field]: 'different' }
    const complete = successful(); validated(await new DualTurnService(complete).begin(raw))
    expect(complete.mock.calls[1][1].responseFormat).toBeUndefined()
  })
  it('offers explicit regeneration after unresolved prose/state conflict and reruns both roles', async () => {
    const conflict = JSON.parse(empty()); conflict.review.push({ code: 'prose-state-conflict', operationIndex: null, reason: 'Cannot move there.', evidenceIds: [] })
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: JSON.stringify(conflict) })
    const service = new DualTurnService(complete), held = await service.begin(request())
    expect(held).toMatchObject({ status: 'held', actions: ['regenerate', 'cancel'] })
    await expect(service.retryManager(identity(held))).rejects.toThrow('retry-unavailable')
    await expect(service.regenerate(identity(held), request())).rejects.toThrow('regenerate-unavailable')
    const fresh = request(); fresh.context.turnId = nextTurnId
    complete.mockResolvedValueOnce({ content: 'Ana: Another reply.' }).mockResolvedValueOnce({ content: empty(nextTurnId) })
    const regenerated = validated(await service.regenerate(identity(held), fresh))
    expect(regenerated.token).not.toBe(held.token); expect(regenerated.attempts).toEqual({ writer: 1, manager: 1 })
    expect(service.cancel(identity(held))).toBe(false)
  })
  it('captures credentials, parameters, language, prompt, and context across an awaited Writer', async () => {
    const raw = request(), saved = LlmProfileSchema.parse({ baseUrl: 'http://manager/v1', model: 'original', apiKey: 'original-key' })
    raw.connections = { ...raw.connections, manager: { ...connection('manager'), resolve: () => saved } }
    let release!: (value: { content: string }) => void
    const complete = vi.fn<typeof singleCompletion>().mockImplementationOnce(() => new Promise((resolve) => { release = resolve })).mockResolvedValue({ content: empty() })
    const task = new DualTurnService(complete).begin(raw)
    saved.model = 'changed'; saved.apiKey = 'changed'; raw.connections = { ...raw.connections, languageInstruction: 'Changed' }; raw.context.sources[0].text = 'changed'; raw.context.content.loveInterests[0].name = 'changed'
    release({ content: writerReply }); validated(await task)
    expect(complete.mock.calls[1][0]).toMatchObject({ model: 'original', apiKey: 'original-key' })
    expect(complete.mock.calls[1][1].languageInstruction).toBe('Write in English.')
    expect(complete.mock.calls[1][1].messages[0].content).not.toContain('changed')
  })
  it('allows cancellation while running, ignores late results, and rejects wrong owner/session/token', async () => {
    let release!: (value: { content: string }) => void
    const complete = vi.fn<typeof singleCompletion>().mockImplementation(() => new Promise((resolve) => { release = resolve }))
    const service = new DualTurnService(complete), task = service.start(request())
    expect(service.cancel({ ...identity(task), ownerId: 'other' })).toBe(false)
    expect(service.cancel({ ...identity(task), sessionId: 'other' })).toBe(false)
    expect(service.cancel({ ...identity(task), token: 'other' })).toBe(false)
    expect(service.cancel(identity(task))).toBe(true)
    release({ content: writerReply })
    expect(await task.result).toMatchObject({ status: 'discarded' }); expect(complete).toHaveBeenCalledTimes(1)
    expect(await service.retryManager(identity(task))).toMatchObject({ status: 'discarded' })
  })
  it('invalidates a held session on reload without allowing another session to clear it', async () => {
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: 'bad' })
    const service = new DualTurnService(complete), held = await service.begin(request())
    expect(service.invalidate('window-a', 'other')).toBe(false)
    expect(service.invalidate('window-a', 'scene-a')).toBe(true)
    expect(await service.retryManager(identity(held))).toMatchObject({ status: 'discarded' })
    expect(complete).toHaveBeenCalledTimes(3)
  })
  it.each(['writer', 'manager'])('discards a %s result when the owning state/content revision changes', async (phase) => {
    let current = true, release!: (value: { content: string }) => void
    const raw = request(); raw.isCurrent = () => current
    const complete = vi.fn<typeof singleCompletion>()
    if (phase === 'manager') complete.mockResolvedValueOnce({ content: writerReply })
    complete.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const service = new DualTurnService(complete), task = service.start(raw)
    await vi.waitFor(() => expect(complete).toHaveBeenCalledTimes(phase === 'writer' ? 1 : 2))
    current = false; release({ content: phase === 'writer' ? writerReply : empty() })
    expect(await task.result).toMatchObject({ status: 'discarded' })
  })
  it('rejects concurrent manual retries and replacement makes the previous request stale', async () => {
    let release!: (value: { content: string }) => void
    const complete = vi.fn<typeof singleCompletion>().mockResolvedValueOnce({ content: writerReply }).mockResolvedValue({ content: 'bad' })
    const service = new DualTurnService(complete), held = await service.begin(request())
    complete.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const retry = service.retryManager(identity(held))
    await expect(service.retryManager(identity(held))).rejects.toThrow('retry-unavailable')
    complete.mockResolvedValueOnce({ content: writerReply }).mockResolvedValueOnce({ content: empty() })
    validated(await service.begin(request()))
    release({ content: empty() }); expect(await retry).toMatchObject({ status: 'discarded' })
  })
  it('runs actual transport serialization through a mocked endpoint', async () => {
    const bodies: Record<string, unknown>[] = []
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init!.body as string); bodies.push(body)
      return new Response(JSON.stringify({ choices: [{ message: { content: body.model === 'writer' ? writerReply : empty() }, finish_reason: 'stop' }], usage: { total_tokens: 4 } }))
    })
    const result = validated(await new DualTurnService((profile, input) => singleCompletion(profile, input, fetcher)).begin(request()))
    expect(bodies.map((body) => body.model)).toEqual(['writer', 'manager'])
    expect(bodies.every((body) => body.tools === undefined && body.tool_choice === undefined)).toBe(true)
    expect(result.usage).toEqual([{ totalTokens: 4 }, { totalTokens: 4 }])
  })
})
