import { z } from 'zod'
import { EXPRESSIONS, poseMedia } from '../model'
import { t } from '../i18n'
import { attendableEvents } from './events'
import { describeWhen, proposeMeeting } from './appointments'
import { hiddenFacts } from './facts'
import { onBirthControl, sexGate } from './intimacy'
import { groupActs } from './groups'
import { wearableOutfits } from './pregnancy'
import { buildCharacterPrompt, clockNote, sceneTurns, type PromptInput } from './prompt'
import { firstNames, sceneCast } from './scene'
import { passSceneTime, sceneDestinations } from './sceneMoves'
import { canSleepOver } from './sleep'
import { moveClash, nextUp, sharedUpcoming, toldTitle } from './upcoming'
import { DualManagerEnvelopeSchema, DualMeetingRequestSchema, type DualMeetingRequest } from './dualTurnContract'
import type { CheckedDualWriter, DualSource, DualValidationContext } from './dualTurnValidation'
import { characterNotes, witnessedAt } from './encounterNotes'

export interface DualPromptInput {
  context: DualValidationContext
  hints?: Omit<PromptInput, 'content' | 'state' | 'loveInterestId' | 'output'>
  meetingRequests?: readonly DualMeetingRequest[]
}

/** Pending and explicitly requested offers precede deterministic local alternatives. No proposal is accepted here. */
export function prepareDualPromptInput(input: DualPromptInput): DualPromptInput {
  const { content, state, scene } = input.context, cast = sceneCast(scene)
  const offers = [...(input.context.meetingOffers ?? [])].slice(0, 12)
  const locations = [...new Set([state.locationId, ...sceneDestinations(content, state, scene).map((place) => place.locationId)])]
  const requests = [...(input.meetingRequests ?? []).slice(0, 12), ...locations.flatMap((placeId) => cast.map((actorId): DualMeetingRequest => ({
    actorId, placeId, activity: t('game.appointments.meetUp'), companionIds: cast.filter((id) => id !== actorId),
    earliest: null, weekday: null, timeOfDay: null
  })))]
  if (!scene.npc) for (const raw of requests) {
    if (offers.length >= 12) break
    const parsed = DualMeetingRequestSchema.safeParse(raw)
    if (!parsed.success) continue
    const request = parsed.data
    if (!cast.includes(request.actorId) || request.companionIds.some((id) => !cast.includes(id) || id === request.actorId)
      || request.weekday !== null && !content.calendar.weekdays.includes(request.weekday)
      || request.timeOfDay !== null && !content.calendar.periods.some((period) => period.id === request.timeOfDay || period.name.toLowerCase() === request.timeOfDay)) continue
    const proposal = proposeMeeting(content, state, request.actorId, { activity: request.activity, place: request.placeId,
      earliest: request.earliest ?? undefined, weekday: request.weekday ?? undefined, timeOfDay: request.timeOfDay ?? undefined,
      with: request.companionIds, named: cast.length > 1 }).proposal
    if (proposal && !offers.some((offer) => JSON.stringify(offer.proposal) === JSON.stringify(proposal))) {
      let index = offers.length
      while (offers.some((offer) => offer.id === `offer:${index}`)) index++
      offers.push({ id: `offer:${index}`, proposal })
    }
  }
  const shared = sharedUpcoming(content, state, cast)
  return { ...input, context: { ...input.context, meetingOffers: scene.npc ? [] : offers,
    pendingProposalRef: scene.proposal ? input.context.pendingProposalRef ?? `proposal:${input.context.turnId}` : undefined,
    nextEventOptionId: shared ? input.context.nextEventOptionId ?? `next:${input.context.turnId}` : undefined } }
}

// JSON Schema helps providers constrain syntax. The shared validator remains authoritative for refinements.
export const dualManagerJsonSchema = z.toJSONSchema(DualManagerEnvelopeSchema, { unrepresentable: 'any' })

export function dualSceneOptions({ context }: DualPromptInput) {
  const { content, state, scene } = context
  const cast = sceneCast(scene), due = nextUp(content, state)
  return {
    destinations: scene.mask || scene.dance ? [] : sceneDestinations(content, state, scene).map(({ id, name, locationId }) => ({ id, name,
      allowedDelays: Array.from({ length: 13 }, (_, hours) => hours).filter((hours) => !moveClash(content, state, passSceneTime(content, state, hours).time, locationId)) })),
    maxDelayHours: 12,
    due: due ? { title: toldTitle(due, cast), time: due.time, locationId: due.locationId } : null,
    nextEvent: context.nextEventOptionId ? { id: context.nextEventOptionId, event: sharedUpcoming(content, state, sceneCast(scene)) } : null,
    pendingMeeting: scene.proposal ? { ref: context.pendingProposalRef, ...scene.proposal, when: describeWhen(content, scene.proposal.time) } : null,
    meetingOffers: (context.meetingOffers ?? []).map((offer) => ({ ...offer, when: describeWhen(content, offer.proposal.time) })),
    meetingSchedule: { weekdays: content.calendar.weekdays, periods: content.calendar.periods.map(({ id, name }) => ({ id, name })) },
    canSleepOver: canSleepOver(content, state),
    events: attendableEvents(content, state).map(({ id, name }) => ({ id, name })),
    groupPoses: groupActs(content, state, scene, (id) => {
      const person = content.loveInterests.find((item) => item.id === id)
      return !!person && sexGate(content, state, person, scene.uninhibited?.includes(id)).open
    })?.acts.map(({ id, name, description }) => ({ id, name, description })) ?? []
  }
}

export function buildDualWriterPrompt(input: DualPromptInput) {
  const { content, state, scene } = input.context
  const currentIds = sceneCast(scene)
  const label = (ids: string[]) => t('scene.dual.witnessLabel', { names: firstNames(content, ids) })
  const messages = scene.messages.flatMap(({ tags: _tags, ...message }, index) => {
    const heard = (index === scene.messages.length - 1 && message.role === 'user' ? currentIds : witnessedAt(scene, index)).filter((id) => currentIds.includes(id))
    if (heard.length === 0) return []
    return [{ ...message, content: `${label(heard)}\n${message.content}` }]
  })
  const sceneBeats = scene.beats.flatMap((beat, index) => {
    const heard = scene.generation?.mode === 'dual' ? scene.generation.beatWitnesses?.find((record) => record.beatIndex === index)?.witnessIds.filter((id) => currentIds.includes(id)) ?? [] : currentIds
    return heard.length ? [{ ...beat, activityName: `${label(heard)} ${beat.activityName}` }] : []
  })
  return {
    system: [buildCharacterPrompt({ ...input.hints, content, state, output: 'writer', loveInterestId: scene.loveInterestId,
      opening: scene.messages.length === 0,
      companionIds: scene.companionIds, lesson: scene.lesson, look: scene, looks: scene.looks,
      comfort: scene.comfort, pendingProposal: scene.proposal, uninhibited: scene.uninhibited,
      roomOf: scene.roomOf, backgroundId: scene.backgroundId, gifts: scene.gifts, presents: scene.presents,
      strangers: scene.strangers, departed: scene.departed,
      sceneBeats }), t('scene.dual.writer'),
    `${t('scene.dual.context')}\n${JSON.stringify(dualSceneOptions(input))}`,
    `${t('scene.dual.noteContext')}\n${JSON.stringify(sceneCast(scene).map((actorId) => ({ actorId, notes: characterNotes(content, scene, actorId),
      comfortAssessments: scene.generation?.mode === 'dual' ? scene.generation.comfortHistory?.[actorId] ?? [] : [] })))}`].join('\n\n'),
    messages: sceneTurns(messages, state.player.name, scene.lesson,
      [clockNote(content, state), input.hints?.firstSpeakerId && t('scene.prompt.firstSpeaker', { name: firstNames(content, [input.hints.firstSpeakerId]) })].filter(Boolean).join(' '))
  }
}

/** Receipts supplied by the engine retain their recorded audience; old history is never assigned new witnesses. */
export function withDualWriterSources(context: DualValidationContext, writer: CheckedDualWriter): DualValidationContext {
  const witnessIds = sceneCast(context.scene)
  const lines = [...writer.text.matchAll(/[^\n]+/g)].filter((match) => match[0].trim().length > 0)
  if (lines.length !== writer.beats.length) throw new Error('writer-source-mismatch')
  return { ...context, sources: [...context.sources, ...writer.beats.map((beat, index): DualSource => ({
    id: `writer:${index}`, kind: 'writer', currentTurn: true, text: lines[index][0],
    replyRange: { start: lines[index].index, end: lines[index].index + lines[index][0].length },
    speaker: beat.speakerId ? { kind: 'character', id: beat.speakerId } : null,
    ...(beat.speakerName && { speakerName: beat.speakerName }), witnessIds
  }))] }
}

export function buildDualManagerPrompt(input: DualPromptInput) {
  const { context } = input
  const { content, state, scene } = context
  const cast = sceneCast(scene).flatMap((id) => {
    const person = content.loveInterests.find((item) => item.id === id)
    if (!person) return []
    return [{ id, name: person.name, personality: person.personality,
      traits: content.traits.filter((trait) => person.traitIds.includes(trait.id)).map(({ id, name, definition }) => ({ id, name, definition })),
      intimacy: sexGate(content, state, person, scene.uninhibited?.includes(id)),
      onBirthControl: onBirthControl(content, state, id), alreadyConceived: scene.conceived.includes(id),
      outfits: wearableOutfits(person, state).map(({ id, name, description }) => ({ id, name, description })),
      expressions: EXPRESSIONS, poses: person.animations.filter((pose) => poseMedia(pose).length > 0).map(({ id, name, description }) => ({ id, name, description })),
      reactions: Object.keys(person.reactions), discoverableFacts: hiddenFacts(content, state, person).map(({ id }) => id),
      appearance: id === scene.loveInterestId ? { outfitId: scene.outfitId, expression: scene.expression, animationId: scene.animationId } : scene.looks?.[id],
      comfort: scene.comfort?.[id], comfortAssessments: scene.generation?.mode === 'dual' ? scene.generation.comfortHistory?.[id] ?? [] : [] }]
  })
  // Keep the latest six historical sources within a bounded budget, without cutting evidence text in half.
  let historyCharacters = 0
  const history = context.sources.filter((source) => source.kind === 'history').slice(-6).reverse().filter((source) => {
    if (historyCharacters + source.text.length > 12_000) return false
    historyCharacters += source.text.length
    return true
  }).reverse()
  const sources = context.sources.filter((source) => source.kind !== 'history').concat(history)
  return {
    system: `${t('scene.dual.manager')}\n${JSON.stringify(dualManagerJsonSchema)}`,
    messages: [{ role: 'user' as const, content: JSON.stringify({ turnId: context.turnId, sources,
      cast, options: dualSceneOptions(input), subjects: context.subjectIds ?? [],
      notes: context.informationTargets ?? [], player: { name: state.player.name }, time: state.time,
      bonds: state.bonds, relationshipStatuses: content.relationships.statuses }) }]
  }
}
