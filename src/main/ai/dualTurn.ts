import { randomUUID } from 'node:crypto'
import type { LlmProfile } from '../../shared/settings'
import { isConfigured } from '../../shared/settings'
import { looksLikeRefusal } from '../../shared/game/refusal'
import { sceneCast } from '../../shared/game/scene'
import { buildDualManagerPrompt, buildDualWriterPrompt, dualManagerJsonSchema, prepareDualPromptInput, withDualWriterSources, type DualPromptInput } from '../../shared/game/dualTurnPrompt'
import { parseDualManagerReply, type DualIssue } from '../../shared/game/dualTurnContract'
import { validateDualManagerReply, validateDualWriterReply, type CheckedDualManager, type CheckedDualWriter, type DualValidationContext } from '../../shared/game/dualTurnValidation'
import type { CapturedConnection, GenerationSnapshot } from '../settings/requestSnapshot'
import { RefusalError } from './openai'
import { buildDualTurnEffects, type DualTurnEffects } from '../../shared/game/dualTurnEffects'
import { singleCompletion, SingleCompletionError, type CompletionUsage, type SingleCompletionInput } from './singleCompletion'

export interface DualTurnRequest extends DualPromptInput {
  ownerId: string
  sessionId: string
  revision: string
  connections: GenerationSnapshot
  /** The owning scene checks both its identity and game/content revisions. */
  isCurrent(): boolean
  /** Only an explicitly verified capability for this exact connection may enable native schema output. */
  nativeSchema?: { profileId: string; baseUrl: string; model: string; verified: true }
}
interface Identity { ownerId: string; sessionId: string; token: string }
export type DualTurnResult =
  | { status: 'discarded'; token: string }
  | { status: 'held'; token: string; role: 'writer' | 'manager'; actions: ('retryManager' | 'regenerate' | 'cancel')[]; issues: DualIssue[]; failure?: string }
  | { status: 'validated'; token: string; writer: CheckedDualWriter; manager: CheckedDualManager;
    effects: DualTurnEffects; writerProfileId: string; managerProfileId: string; writerUsedNsfw: boolean; attempts: { writer: number; manager: number }; usage: CompletionUsage[] }

interface Resolved { id: string; profile: LlmProfile }
interface Pending {
  identity: Identity; request: Omit<DualTurnRequest, 'connections'>; controller: AbortController
  writerProfile: Resolved; managerProfile: Resolved; nsfw: Resolved | Error | null
  writerInput: SingleCompletionInput; managerInput: SingleCompletionInput
  context: DualValidationContext; written?: CheckedDualWriter
  busy: boolean; validated: boolean; usedNsfw: boolean; format: boolean
  actions: ('retryManager' | 'regenerate' | 'cancel')[]
  attempts: { writer: number; manager: number }; usage: CompletionUsage[]
}
const resolve = (connection: CapturedConnection | null): Resolved => {
  if (!connection) throw new Error('profile-required')
  let profile: LlmProfile
  try { profile = { ...connection.resolve() } } catch { throw new Error('credential-unavailable') }
  if (!isConfigured(profile)) throw new Error('profile-unconfigured')
  return { id: connection.id, profile }
}

/** Privileged, dormant orchestration. Validation yields a candidate; it never publishes or commits game state. */
export class DualTurnService {
  private readonly pending = new Map<string, Pending>()
  constructor(private readonly complete: typeof singleCompletion = singleCompletion) {}

  start(raw: DualTurnRequest): { token: string; result: Promise<DualTurnResult> } {
    const token = randomUUID()
    return { token, result: this.run(raw, token) }
  }

  begin(raw: DualTurnRequest): Promise<DualTurnResult> { return this.start(raw).result }

  private async run(raw: DualTurnRequest, token: string): Promise<DualTurnResult> {
    const previous = this.pending.get(raw.ownerId)
    if (previous) this.drop(previous)
    if (!raw.ownerId || !raw.sessionId || !raw.revision || raw.connections.generationMode !== 'dual') throw new Error('dual-request-required')
    const identity = { ownerId: raw.ownerId, sessionId: raw.sessionId, token }
    if (!raw.isCurrent()) return { status: 'discarded', token: identity.token }
    // Capture every credential now; an unavailable unused NSFW key need not block an ordinary Writer call.
    const writerProfile = resolve(raw.connections.writer), managerProfile = resolve(raw.connections.manager)
    let nsfw: Resolved | Error | null = null
    try { nsfw = raw.connections.nsfw ? resolve(raw.connections.nsfw) : null } catch { nsfw = new Error('credential-unavailable') }
    const captured = structuredClone({ context: raw.context, hints: raw.hints, meetingRequests: raw.meetingRequests, nativeSchema: raw.nativeSchema })
    const request = { ownerId: raw.ownerId, sessionId: raw.sessionId, revision: raw.revision, isCurrent: raw.isCurrent,
      ...captured, ...prepareDualPromptInput(captured) }
    if (request.context.sources.some((source) => source.kind === 'writer' || source.id.startsWith('writer:'))) throw new Error('writer-source-reserved')
    const capability = request.nativeSchema
    const format = capability?.verified === true && capability.profileId === managerProfile.id
      && capability.baseUrl === managerProfile.profile.baseUrl && capability.model === managerProfile.profile.model
    const pending: Pending = { identity, request, writerProfile, managerProfile, nsfw, controller: new AbortController(),
      writerInput: { ...buildDualWriterPrompt(request), languageInstruction: raw.connections.languageInstruction },
      managerInput: { ...buildDualManagerPrompt(request), languageInstruction: raw.connections.languageInstruction },
      context: request.context, busy: true, validated: false, usedNsfw: false, format,
      attempts: { writer: 0, manager: 0 }, usage: [], actions: [] }
    this.pending.set(identity.ownerId, pending)
    try {
      if (request.context.scene.nsfw) {
        if (nsfw instanceof Error) throw nsfw
        // Existing scenes without a configured NSFW connection still use their primary writer.
        if (nsfw) { pending.writerProfile = nsfw; pending.usedNsfw = true }
      }
      let written: string
      try { written = await this.write(pending) } catch (error) {
        if (!(error instanceof RefusalError) || pending.usedNsfw || !pending.nsfw) throw error
        if (!this.current(pending)) return this.discard(pending)
        if (pending.nsfw instanceof Error) throw pending.nsfw
        pending.writerProfile = pending.nsfw; pending.usedNsfw = true
        written = await this.write(pending)
      }
      if (!this.current(pending)) return this.discard(pending)
      const cast = sceneCast(pending.context.scene).flatMap((id) => pending.context.content.loveInterests.filter((person) => person.id === id))
      const checked = validateDualWriterReply(written, { cast, playerName: pending.context.state.player.name,
        voices: [pending.context.scene.lesson?.speaker, ...(request.hints?.extras?.map((extra) => extra.name) ?? [])].filter((voice): voice is string => !!voice) })
      if (!checked.ok) return this.hold(pending, 'writer', checked.issues)
      pending.written = checked.value
      pending.context = withDualWriterSources(pending.context, checked.value)
      const projection = JSON.parse(pending.managerInput.messages[0].content) as { sources: unknown[] }
      projection.sources.push(...pending.context.sources.filter((source) => source.kind === 'writer'))
      pending.managerInput.messages[0].content = JSON.stringify(projection)
      return await this.manage(pending, 2)
    } catch (error) {
      if (!this.current(pending)) return this.discard(pending)
      return this.hold(pending, 'writer', [], this.failure(error))
    }
  }

  async retryManager(identity: Identity): Promise<DualTurnResult> {
    const pending = this.owned(identity)
    if (!pending) return { status: 'discarded', token: identity.token }
    if (!this.current(pending)) return this.discard(pending)
    if (pending.busy || !pending.actions.includes('retryManager')) throw new Error('retry-unavailable')
    pending.busy = true; pending.actions = []
    return this.manage(pending, 1)
  }

  async regenerate(identity: Identity, request: DualTurnRequest): Promise<DualTurnResult> {
    const pending = this.owned(identity)
    if (!pending) return { status: 'discarded', token: identity.token }
    if (!this.current(pending)) return this.discard(pending)
    if (pending.busy || !pending.actions.includes('regenerate') || request.ownerId !== identity.ownerId || request.sessionId !== identity.sessionId
      || request.context.turnId === pending.context.turnId) throw new Error('regenerate-unavailable')
    return this.begin(request)
  }

  cancel(identity: Identity): boolean {
    const pending = this.owned(identity)
    if (!pending) return false
    this.drop(pending)
    return true
  }

  invalidate(ownerId: string, sessionId: string): boolean {
    const pending = this.pending.get(ownerId)
    if (!pending || pending.identity.sessionId !== sessionId) return false
    this.drop(pending)
    return true
  }

  canRegenerate(identity: Identity): boolean {
    const pending = this.owned(identity)
    return !!pending && this.current(pending) && !pending.busy && pending.actions.includes('regenerate')
  }

  acknowledge(identity: Identity): boolean {
    const pending = this.owned(identity)
    if (!pending || !pending.validated) return false
    if (!this.current(pending)) { this.drop(pending); return false }
    this.drop(pending)
    return true
  }

  private async write(pending: Pending): Promise<string> {
    pending.attempts.writer++
    const reply = await this.complete(pending.writerProfile.profile, { ...pending.writerInput, signal: pending.controller.signal,
      ...(pending.context.scene.lesson && pending.context.scene.messages.length === 0 ? { maxTokens: Math.max(900, pending.writerProfile.profile.maxTokens) } : {}) })
    if (reply.usage) pending.usage.push(reply.usage)
    const prose = reply.content.replace(/^\s*<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>\s*/i, '')
    if (looksLikeRefusal(prose)) throw new RefusalError('Writer refused the request.')
    return reply.content
  }

  private async manage(pending: Pending, budget: number): Promise<DualTurnResult> {
    let issues: DualIssue[] = [], failure: string | undefined, conflict = false
    for (let attempt = 0; attempt < budget; attempt++) {
      if (!this.current(pending)) return this.discard(pending)
      pending.attempts.manager++
      try {
        const reply = await this.complete(pending.managerProfile.profile, { ...pending.managerInput, signal: pending.controller.signal,
          ...(pending.format && { responseFormat: { type: 'json_schema', json_schema: { name: 'scene_turn', strict: true, schema: dualManagerJsonSchema } } }) })
        if (!this.current(pending)) return this.discard(pending)
        if (reply.usage) pending.usage.push(reply.usage)
        const parsed = parseDualManagerReply(reply.content)
        conflict ||= parsed.ok && parsed.value.review.some((item) => item.code === 'prose-state-conflict')
        const checked = validateDualManagerReply(reply.content, pending.context)
        if (checked.ok) {
          const effects = buildDualTurnEffects(pending.context, pending.written!, checked.value, {
            writerProfileId: pending.writerProfile.id, managerProfileId: pending.managerProfile.id, writerUsedNsfw: pending.usedNsfw })
          if (!effects.ok) { issues = effects.issues; conflict = true; failure = undefined; continue }
          pending.busy = false; pending.validated = true; pending.actions = []
          return { status: 'validated', token: pending.identity.token, writer: structuredClone(pending.written!), manager: checked.value,
            effects: { ...effects.value, systemPrompt: pending.writerInput.system },
            writerProfileId: pending.writerProfile.id, managerProfileId: pending.managerProfile.id,
            writerUsedNsfw: pending.usedNsfw, attempts: { ...pending.attempts }, usage: structuredClone(pending.usage) }
        }
        issues = checked.issues; failure = undefined
      } catch (error) {
        if (!this.current(pending)) return this.discard(pending)
        if (error instanceof SingleCompletionError && error.code === 'format-unsupported') pending.format = false
        issues = []; failure = this.failure(error)
      }
    }
    return this.hold(pending, 'manager', issues, failure, conflict)
  }

  private hold(pending: Pending, role: 'writer' | 'manager', issues: DualIssue[], failure?: string, conflict = false): DualTurnResult {
    pending.busy = false
    pending.actions = role === 'manager' && !conflict ? ['retryManager', 'cancel'] : ['regenerate', 'cancel']
    return { status: 'held', token: pending.identity.token, role, actions: [...pending.actions], issues, ...(failure && { failure }) }
  }
  private failure(error: unknown): string {
    return error instanceof SingleCompletionError ? error.code : error instanceof RefusalError ? 'refused' : 'request-failed'
  }
  private owned(identity: Identity): Pending | undefined {
    const pending = this.pending.get(identity.ownerId)
    return pending?.identity.sessionId === identity.sessionId && pending.identity.token === identity.token ? pending : undefined
  }
  private current(pending: Pending): boolean {
    try { return this.pending.get(pending.identity.ownerId) === pending && !pending.controller.signal.aborted && pending.request.isCurrent() } catch { return false }
  }
  private drop(pending: Pending): void {
    if (this.pending.get(pending.identity.ownerId) === pending) this.pending.delete(pending.identity.ownerId)
    pending.controller.abort()
  }
  private discard(pending: Pending): DualTurnResult {
    this.drop(pending)
    return { status: 'discarded', token: pending.identity.token }
  }
}
