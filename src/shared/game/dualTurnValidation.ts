import type { ContentPack, GameState, LoveInterest, Proposal, Scene } from '../model'
import { poseMedia } from '../model'
import { proposeMeeting } from './appointments'
import { bondOf, canBond, END_BOND } from './bonds'
import { attendableEvents } from './events'
import { hiddenFacts } from './facts'
import { groupPose } from './groups'
import { sexGate } from './intimacy'
import { wornOutfit } from './pregnancy'
import { dialogueLines, leavers, namedAt, sceneCast, sceneWitnesses, validLook } from './scene'
import { findDestination, passSceneTime, sceneDestinations } from './sceneMoves'
import { canSleepOver } from './sleep'
import { moveClash, sharedUpcoming } from './upcoming'
import {
  DUAL_TURN_LIMITS, parseDualManagerReply, type DualActor, type DualCheck, type DualComfort,
  type DualEvidence, type DualIssue, type DualIssueCode, type DualManagerEnvelope,
  type DualNoteEntry, type DualOperation, type DualPresentation
} from './dualTurnContract'

type PlayerAction =
  | { type: 'moveScene'; destinationId: string; hours: number; stayingIds: readonly string[] }
  | { type: 'walkToEvent'; optionId: string }
  | { type: 'acceptMeeting'; proposalRef: string }
  | { type: 'sleepOver' } | { type: 'endScene' }
export interface DualSource {
  id: string
  kind: 'player' | 'writer' | 'history' | 'context'
  text: string
  currentTurn: boolean
  speaker: DualActor | null
  /** A teacher or other extra voice is distinct from unattributed narration. */
  speakerName?: string
  /** Maps a canonical raw Writer line back into the unpublished reply for later receipt storage. */
  replyRange?: { start: number; end: number }
  messageIndex?: number
  messageRange?: { start: number; end: number }
  turnId?: string
  witnessIds: readonly string[]
  /** Only an engine-recorded action may authorize an action without player text. Eligibility is not authorization. */
  playerAction?: PlayerAction
}
export interface DualValidationContext {
  turnId: string
  /** The same personalized/housing/NPC/mask-derived content used to prepare this captured scene. */
  content: ContentPack
  state: GameState
  scene: Scene
  sources: readonly DualSource[]
  pendingProposalRef?: string
  nextEventOptionId?: string
  meetingOffers?: readonly { id: string; proposal: Proposal }[]
  informationTargets?: readonly DualNoteEntry[]
  subjectIds?: readonly string[]
}
export interface CheckedDualManager {
  envelope: DualManagerEnvelope
  operationCandidates: DualOperation[]
  informationWitnessIds: string[][]
  /** Mechanical checks cannot prove the meaning of free-text agreement or all prose/state consistency. */
  requiresConsistencyReview: true
}

const actorKey = (actor: DualActor) => actor.kind === 'player' ? 'player' : `character:${actor.id}`
const sameSet = (one: readonly string[], two: readonly string[]) => one.length === two.length && [...one].sort().every((id, index) => id === [...two].sort()[index])
const splitSurrogate = (text: string, at: number) => at > 0 && at < text.length
  && /[\uD800-\uDBFF]/.test(text[at - 1]) && /[\uDC00-\uDFFF]/.test(text[at])

function signature(item: object): string {
  return JSON.stringify(item, (key, value: unknown) => {
    if (key === 'evidenceIds') return undefined
    return ['actorIds', 'stayingIds', 'memberIds', 'companionIds'].includes(key) && Array.isArray(value) ? [...value].sort() : value
  })
}

export function validateDualManagerReply(written: string, context: DualValidationContext): DualCheck<CheckedDualManager> {
  const parsed = parseDualManagerReply(written)
  if (!parsed.ok) return parsed
  const envelope = parsed.value
  const issues: DualIssue[] = []
  const fail = (code: DualIssueCode, path: (string | number)[]) => {
    if (issues.length < DUAL_TURN_LIMITS.issues) issues.push({ code, path })
  }
  if (envelope.turnId !== context.turnId) fail('stale-turn', ['turnId'])
  const { content, state, scene } = context
  const cast = sceneCast(scene)
  const witnesses = new Set(sceneWitnesses(scene))
  const sources = new Map(context.sources.map((source) => [source.id, source]))
  if (sources.size !== context.sources.length || new Set(cast).size !== cast.length) fail('context', [])
  for (const source of context.sources) {
    if (source.messageIndex !== undefined) {
      const message = scene.messages[source.messageIndex]
      const range = source.messageRange
      if (!Number.isSafeInteger(source.messageIndex) || source.messageIndex < 0 || !message || !range
        || !Number.isSafeInteger(range.start) || !Number.isSafeInteger(range.end) || range.start < 0
        || range.end > message.content.length || range.end - range.start !== source.text.length
        || message.content.slice(range.start, range.end) !== source.text
        || source.kind === 'player' && (message.role !== 'user' || source.messageIndex !== scene.messages.length - 1)) fail('context', [])
    } else if (source.messageRange !== undefined) fail('context', [])
    if (new Set(source.witnessIds).size !== source.witnessIds.length || source.witnessIds.some((id) => !witnesses.has(id))
      || (source.currentTurn && (source.kind === 'player' || source.kind === 'writer') && source.witnessIds.some((id) => !cast.includes(id)))
      || (source.kind === 'player' && (!source.currentTurn || source.speaker?.kind !== 'player'))
      || (source.kind === 'history' && source.currentTurn)
      || (source.kind === 'writer' && (!source.currentTurn || source.speaker?.kind === 'player'
        || source.speaker?.kind === 'character' && !cast.includes(source.speaker.id)))
      || (source.speakerName !== undefined && (!source.speakerName.trim() || source.speaker !== null || !['writer', 'history'].includes(source.kind)))
      || (source.replyRange !== undefined && (source.kind !== 'writer' || !Number.isSafeInteger(source.replyRange.start)
        || !Number.isSafeInteger(source.replyRange.end) || source.replyRange.start < 0 || source.replyRange.end - source.replyRange.start !== source.text.length))
      || (source.kind === 'context' && source.speaker !== null)
      || (source.playerAction && (source.kind !== 'context' || !source.currentTurn))) fail('context', [])
    if (source.speaker?.kind === 'character' && !witnesses.has(source.speaker.id)) fail('context', [])
  }
  if (context.subjectIds?.some((id) => !content.loveInterests.some((person) => person.id === id) && !content.npcs.some((person) => person.id === id))) fail('context', [])
  const evidence = new Map(envelope.evidence.map((span) => [span.id, span]))
  envelope.evidence.forEach((span, index) => {
    const source = sources.get(span.sourceId)
    if (!source) return fail('evidence-source', ['evidence', index])
    if (span.end > source.text.length || splitSurrogate(source.text, span.start) || splitSurrogate(source.text, span.end)
      || source.text.slice(span.start, span.end) !== span.quote) fail('evidence-span', ['evidence', index])
  })
  if (issues.length) return { ok: false, issues }
  const cited = (item: { evidenceIds: string[] }) => item.evidenceIds.flatMap((id) => {
    const span = evidence.get(id)
    const source = span && sources.get(span.sourceId)
    return source && span ? [{ source, span }] : []
  })
  const current = (item: { evidenceIds: string[] }) => cited(item).filter(({ source }) => source.currentTurn && source.kind !== 'history')
  const writer = (item: { evidenceIds: string[] }) => current(item).filter(({ source }) => source.kind === 'writer')
  const who = (id: string) => content.loveInterests.find((person) => person.id === id)
  const eligible = (id: string) => cast.includes(id) && who(id) !== undefined
  if (cast.some((id) => !who(id))) fail('context', [])
  const willing = (id: string) => {
    const person = who(id)
    return !!person && sexGate(content, state, person, scene.uninhibited?.includes(id)).open
  }
  const saysFor = (source: DualSource, span: DualEvidence, id: string) => source.kind === 'writer' && source.currentTurn && (
    source.speaker?.kind === 'character' ? source.speaker.id === id
      : source.speaker === null && !source.speakerName && (cast.length === 1 && cast[0] === id || !!who(id) && namedAt(span.quote, who(id)!) >= 0)
  )
  const writerFor = (item: { evidenceIds: string[] }, id: string) => writer(item).some(({ source, span }) => saysFor(source, span, id))
  const playerEvidence = (item: { evidenceIds: string[] }, action: PlayerAction) => current(item).some(({ source }) => {
    if (source.kind === 'player') return true
    const recorded = source.playerAction
    if (!recorded || recorded.type !== action.type) return false
    switch (action.type) {
      case 'moveScene': return recorded.type === 'moveScene' && recorded.destinationId === action.destinationId && recorded.hours === action.hours && sameSet(recorded.stayingIds, action.stayingIds)
      case 'walkToEvent': return recorded.type === 'walkToEvent' && recorded.optionId === action.optionId
      case 'acceptMeeting': return recorded.type === 'acceptMeeting' && recorded.proposalRef === action.proposalRef
      default: return true
    }
  })

  envelope.operations.forEach((operation, index) => {
    const path = ['operations', index]
    const speech = current(operation).some(({ source }) => source.kind === 'player' || source.kind === 'writer')
    const explicit = operation.type === 'moveScene' || operation.type === 'walkToEvent' || operation.type === 'acceptMeeting'
      || operation.type === 'sleepOver' || operation.type === 'endScene' ? playerEvidence(operation, operation) : false
    if (!speech && !explicit) fail('evidence-current', path)
    if (scene.npc && operation.type !== 'endScene') { fail('actor', path); return }
    switch (operation.type) {
      case 'moveScene': {
        const destination = findDestination(sceneDestinations(content, state, scene), operation.destinationId)
        if (scene.mask || scene.dance || !destination || destination.id !== operation.destinationId
          || operation.stayingIds.some((id) => !eligible(id)) || operation.stayingIds.length >= cast.length) fail('game-rule', path)
        if (destination && moveClash(content, state, passSceneTime(content, state, operation.hours).time, destination.locationId)) fail('game-rule', path)
        if (operation.stage !== 'invited' && !playerEvidence(operation, operation)) fail('agency', path)
        break
      }
      case 'walkToEvent': {
        const shared = sharedUpcoming(content, state, cast)
        if (scene.mask || scene.dance || !shared || !context.nextEventOptionId || operation.optionId !== context.nextEventOptionId) fail('game-rule', path)
        if (operation.stage !== 'invited' && !playerEvidence(operation, operation)) fail('agency', path)
        break
      }
      case 'proposeMeeting': {
        const request = operation.request
        if (!eligible(request.actorId) || request.companionIds.includes(request.actorId) || request.companionIds.some((id) => !eligible(id))) { fail('actor', path); return }
        if (!writerFor(operation, request.actorId)) fail('evidence-attribution', path)
        if (request.weekday !== null && !content.calendar.weekdays.includes(request.weekday)) fail('game-rule', path)
        if (request.timeOfDay !== null && !content.calendar.periods.some((period) => period.id === request.timeOfDay || period.name.toLowerCase() === request.timeOfDay)) fail('game-rule', path)
        const made = proposeMeeting(content, state, request.actorId, {
          activity: request.activity, place: request.placeId, earliest: request.earliest ?? undefined,
          weekday: request.weekday ?? undefined, timeOfDay: request.timeOfDay ?? undefined,
          with: request.companionIds, named: cast.length > 1
        }).proposal
        if (!made) fail('game-rule', path)
        if (operation.offerId !== null) {
          const offer = context.meetingOffers?.find((item) => item.id === operation.offerId)?.proposal
          if (!offer || !made || offer.time !== made.time || offer.hours !== made.hours || offer.locationId !== made.locationId
            || offer.loveInterestId !== made.loveInterestId || offer.title !== made.title || !sameSet(offer.companionIds, made.companionIds)) fail('game-rule', path)
        }
        break
      }
      case 'acceptMeeting':
        if (!scene.proposal || scene.proposal.time <= state.time || !context.pendingProposalRef || operation.proposalRef !== context.pendingProposalRef) fail('game-rule', path)
        if (!playerEvidence(operation, operation)) fail('agency', path)
        break
      case 'proposeBond':
        if (!operation.memberIds.includes(scene.loveInterestId) || operation.memberIds.some((id) => !eligible(id))) fail('actor', path)
        if (!writerFor(operation, scene.loveInterestId)) fail('evidence-attribution', path)
        if (operation.statusId === END_BOND) {
          if (operation.memberIds.length !== 1 || !bondOf(state, scene.loveInterestId)) fail('game-rule', path)
        } else if (!canBond(content, state, operation).ok) fail('game-rule', path)
        break
      case 'leaveScene':
        if (operation.actorIds.some((id) => !eligible(id)) || leavers(scene, operation.actorIds).length !== operation.actorIds.length) fail('actor', path)
        if (operation.actorIds.some((id) => !writerFor(operation, id))) fail('evidence-attribution', path)
        break
      case 'attendEvent':
        if (!attendableEvents(content, state).some((event) => event.id === operation.eventId)) fail('game-rule', path)
        if (operation.actorIds.some((id) => !eligible(id))) fail('actor', path)
        if (operation.actorIds.some((id) => !writerFor(operation, id) || cast.length > 1
          && !writer(operation).some(({ source }) => source.speaker?.kind === 'character' && source.speaker.id === id))) fail('evidence-attribution', path)
        break
      case 'sleepOver':
        if (!canSleepOver(content, state)) fail('game-rule', path)
        if (operation.stage !== 'invited' && !playerEvidence(operation, operation)) fail('agency', path)
        break
      case 'endScene':
        if (!writer(operation).length && !current(operation).some(({ source }) => source.playerAction?.type === 'endScene')) fail('evidence-attribution', path)
        break
      case 'stopBirthControl':
      case 'potentialConception':
        if (!eligible(operation.actorId)) fail('actor', path)
        if (!writerFor(operation, operation.actorId)) fail('evidence-attribution', path)
        if (operation.type === 'potentialConception' && !willing(operation.actorId)) fail('game-rule', path)
        break
    }
  })

  envelope.presentation.forEach((selection, index) => {
    const path = ['presentation', index]
    const person = who(selection.actorId)
    if (!person || !eligible(selection.actorId)) { fail('actor', path); return }
    const existing = selection.actorId === scene.loveInterestId ? scene : scene.looks?.[selection.actorId] ?? {}
    switch (selection.type) {
      case 'appearance': {
        const look = validLook({ outfitId: selection.outfitId ?? undefined, expression: selection.expression ?? undefined }, person, existing)
        if (selection.outfitId !== null && (look.outfitId !== selection.outfitId || !scene.npc && !wornOutfit(content, state, person, selection.outfitId))) fail('asset', path)
        if (selection.expression !== null && look.expression !== selection.expression) fail('asset', path)
        if (selection.outfitId !== null && !writerFor(selection, selection.actorId)) fail('evidence-attribution', path)
        break
      }
      case 'pose': {
        if (scene.npc) fail('actor', path)
        if (!writerFor(selection, selection.actorId)) fail('evidence-attribution', path)
        if (selection.animationId !== null) {
          const pose = person.animations.find((item) => item.id === selection.animationId && poseMedia(item).length > 0)
          const together = groupPose(content, state, scene, selection.animationId, willing)
          if ((!pose && (!together || together.pose.id !== selection.animationId)) || !willing(selection.actorId)) fail('asset', path)
        }
        break
      }
      case 'reaction':
        if (scene.npc) fail('actor', path)
        if (!Object.hasOwn(person.reactions, selection.reactionId) || !person.reactions[selection.reactionId]) fail('asset', path)
        if (!writerFor(selection, selection.actorId)) fail('evidence-attribution', path)
        break
    }
  })
  envelope.comfort.forEach((reading, index) => {
    if (scene.npc || !eligible(reading.actorId)) fail('actor', ['comfort', index])
  })

  const subjectIds = new Set(context.subjectIds ?? cast)
  const informationWitnessIds: string[][] = []
  envelope.information.forEach((information, index) => {
    const path = ['information', index]
    const disclosures = current(information).filter(({ source }) => source.kind === 'player' || source.kind === 'writer')
    if (!disclosures.length) fail('evidence-current', path)
    if (information.subjects.some((subject) => subject.kind === 'character' && !subjectIds.has(subject.id))) fail('subject', path)
    const quoted = cited(information).filter(({ source }) => source.kind !== 'context')
    const visible = disclosures.length && quoted.length ? quoted[0].source.witnessIds.filter((id) => quoted.every(({ source }) => source.witnessIds.includes(id))) : []
    informationWitnessIds.push([...visible])
    if (information.action !== 'record') {
      const target = context.informationTargets?.find((entry) => entry.id === information.targetEntryId)
      if (!target || target.category !== information.category || target.factId !== information.factId
        || !sameSet(target.subjects.map(actorKey), information.subjects.map(actorKey))) fail('information-target', path)
    }
    if (information.category === 'discovery') {
      const subject = information.subjects.length === 1 ? information.subjects[0] : undefined
      const person = subject?.kind === 'character' ? who(subject.id) : undefined
      if (scene.npc || !person || !hiddenFacts(content, state, person).some((fact) => fact.id === information.factId)) fail('information-fact', path)
      if (!person || !writerFor(information, person.id)) fail('evidence-attribution', path)
    }
  })
  envelope.review.forEach((_item, index) => fail('review', ['review', index]))

  function deduplicate<T extends DualOperation | DualPresentation | DualComfort>(items: readonly T[], key: (item: T) => string, name: string): T[] {
    const seen = new Map<string, string>()
    return items.filter((item, index) => {
      const slot = key(item), value = signature(item), previous = seen.get(slot)
      if (previous !== undefined) {
        if (previous !== value) fail('conflict', [name, index])
        return false
      }
      seen.set(slot, value)
      return true
    })
  }
  const operations = deduplicate(envelope.operations, (operation) => {
    if (operation.type === 'potentialConception' || operation.type === 'stopBirthControl') return `${operation.type}:${operation.actorId}`
    if (operation.type === 'attendEvent') return JSON.stringify([operation.type, operation.eventId, [...operation.actorIds].sort()])
    return operation.type
  }, 'operations')
  const presentation = deduplicate(envelope.presentation, (selection) => selection.type === 'appearance' ? `appearance:${selection.actorId}` : selection.type, 'presentation')
  const comfort = deduplicate(envelope.comfort, (reading) => reading.actorId, 'comfort')
  const travel = operations.filter((operation) => ['moveScene', 'walkToEvent', 'sleepOver'].includes(operation.type))
  if (travel.length > 1) fail('conflict', ['operations'])
  const move = operations.find((operation) => operation.type === 'moveScene')
  const leaving = operations.find((operation) => operation.type === 'leaveScene')
  if (move && leaving && move.stayingIds.length > 0 && (!sameSet(move.stayingIds, leaving.actorIds) || leaving.feeling !== 'content')) fail('conflict', ['operations'])
  if (operations.some((operation) => operation.type === 'walkToEvent') && leaving) {
    const shared = sharedUpcoming(content, state, cast)
    if (shared?.sharedBy.some((id) => leaving.actorIds.includes(id))) fail('conflict', ['operations'])
  }
  const proposal = operations.find((operation) => operation.type === 'proposeMeeting')
  if (proposal && operations.some((operation) => operation.type === 'acceptMeeting') && proposal.request.placeId !== scene.proposal?.locationId) fail('conflict', ['operations'])
  if (issues.length) return { ok: false, issues }
  const normalized = { ...envelope, operations, presentation, comfort }
  return { ok: true, value: {
    envelope: normalized,
    operationCandidates: operations.filter((operation) => !('stage' in operation) || operation.stage !== 'invited'),
    informationWitnessIds, requiresConsistencyReview: true
  } }
}

export interface CheckedDualWriter { text: string; beats: ReturnType<typeof dialogueLines> }
export function validateDualWriterReply(written: string, options: {
  cast?: Pick<LoveInterest, 'id' | 'name'>[]; voices?: string[]; playerName?: string; toolCalls?: readonly unknown[]
} = {}): DualCheck<CheckedDualWriter> {
  const fail = (code: DualIssueCode): DualCheck<CheckedDualWriter> => ({ ok: false, issues: [{ code, path: [] }] })
  if (written.length > DUAL_TURN_LIMITS.writerCharacters) return fail('writer-size')
  let text = written.replace(/\r\n/g, '\n').trim()
  const reasoning = /^<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>\s*/i
  while (reasoning.test(text)) text = text.replace(reasoning, '')
  if (!text) return fail('writer-empty')
  const check = text.replace(/[［【]/g, '[').replace(/[］】]/g, ']').replace(/：/g, ':').replace(/＝/g, '=')
  const tag = /\[\s*(?:END[\s_-]*SCENE\b|(?:MOVE|HOURS|OUTFIT|EXPRESSION|ANIMATION|POSE|SEX[\s_-]?ACT|COMFORT|LEAVES?|ATTENDING|REACTS?)\s*:|AGREED\b|SLEEP\b|SEEDED\b|STOPS?[\s_-]*BIRTH[\s_-]*CONTROL\b)/i
  const command = /\b(?:move_scene|propose_meeting|propose_relationship)\s*\(/i
  const curly = /\{\s*["']?(?:move_scene|propose_meeting|propose_relationship|end_scene)["']?\s*:/i
  const toolObject = /["'](?:name|function|tool)["']\s*:\s*["'](?:move_scene|propose_meeting|propose_relationship)["']/i
  const operationObject = /["']type["']\s*:\s*["'](?:moveScene|walkToEvent|proposeMeeting|acceptMeeting|proposeBond|leaveScene|attendEvent|sleepOver|endScene|stopBirthControl|potentialConception)["']/i
  const managerObject = /["']schemaVersion["']\s*:/.test(check) && /["'](?:operations|information|presentation|comfort|review)["']\s*:\s*\[/.test(check)
  if (options.toolCalls?.length || tag.test(check.replace(/\{/g, '[')) || /\[\s*COMF[A-Z]*/.test(check)
    || command.test(check) || curly.test(check) || toolObject.test(check) || operationObject.test(check) || managerObject
    || /["'](?:tool_calls|function_call)["']\s*:/.test(check)
    || /^\s*<think(?:ing)?>/im.test(check)
    || /<(?:tool_call|function_call)\b/i.test(check)) return fail('writer-control')
  const beats = dialogueLines(text, options.cast, options.voices)
  if (options.playerName) {
    const escaped = options.playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`^\\s*\\**${escaped}\\**\\s*[:：]`, 'im').test(text)) return fail('agency')
  }
  if (!beats.length) return fail('writer-empty')
  if (beats.length > DUAL_TURN_LIMITS.writerBeats) return fail('writer-size')
  return { ok: true, value: { text, beats } }
}
