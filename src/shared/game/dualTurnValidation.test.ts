import { describe, expect, it } from 'vitest'
import { AnimationSchema, RelationshipStatusSchema, type ContentPack, type Scene } from '../model'
import { proposeMeeting } from './appointments'
import { attendableEvents } from './events'
import { sceneBaseline } from './scene'
import { createInitialState } from './state'
import { fixture } from './testFixture'
import { type DualCheck, type DualIssueCode, type DualManagerEnvelope, type DualNoteEntry, type DualOperation } from './dualTurnContract'
import { validateDualManagerReply, validateDualWriterReply, type CheckedDualManager, type DualSource, type DualValidationContext } from './dualTurnValidation'
import transitionBaseline from '../../main/ai/fixtures/transitionBaseline.json'

const turnId = '11111111-1111-4111-8111-111111111111'
function setup(group = false): DualValidationContext {
  const base = fixture()
  const ana = { ...base.loveInterests[0], likes: ['tea'], birthControl: true, reactions: { laugh: 'ana.ogg' },
    animations: [AnimationSchema.parse({ id: 'creampie', name: 'Moment', description: 'A moment.', image: 'moment.png' })] }
  const content: ContentPack = { ...base, loveInterests: group ? [ana, { ...ana, id: 'bea', name: 'Bea' }] : [ana],
    relationships: { ...base.relationships, statuses: [RelationshipStatusSchema.parse({ id: 'dating', name: 'Dating' })] },
    calendar: { ...base.calendar, events: base.calendar.events.map((event) => ({ ...event, startHour: 8, locationId: 'shop' })) } }
  const state = createInitialState(content)
  const companionIds = group ? ['bea'] : []
  const scene: Scene = { loveInterestId: 'ana', companionIds, npc: false, nsfw: false,
    beats: [{ activityName: 'Tea' }], messages: [], gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana', companionIds) }
  const witnessIds = ['ana', ...companionIds]
  return { turnId, content, state, scene, sources: [
    { id: 'p', kind: 'player', text: "Let's go to the shop.", currentTurn: true, speaker: { kind: 'player' }, witnessIds },
    { id: 'w', kind: 'writer', text: "Ana: I'll come with you.", currentTurn: true, speaker: { kind: 'character', id: 'ana' }, witnessIds },
    { id: 'h', kind: 'history', text: 'Yes.', currentTurn: false, speaker: { kind: 'player' }, witnessIds },
    { id: 'c', kind: 'context', text: 'The shop is eligible.', currentTurn: true, speaker: null, witnessIds: [] }
  ] }
}
const empty = (): DualManagerEnvelope => ({ schemaVersion: 1, turnId, evidence: [], operations: [], presentation: [], comfort: [], information: [], review: [] })
function proof(envelope: DualManagerEnvelope, context: DualValidationContext, sourceId = 'w', start = 0, end?: number): string {
  const source = context.sources.find((item) => item.id === sourceId)!
  const id = `e${envelope.evidence.length}`
  const until = end ?? source.text.length
  envelope.evidence.push({ id, sourceId, start, end: until, quote: source.text.slice(start, until) })
  return id
}
const check = (envelope: DualManagerEnvelope, context: DualValidationContext) => validateDualManagerReply(JSON.stringify(envelope), context)
function accepted(result: DualCheck<CheckedDualManager>): CheckedDualManager {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.value
}
function rejected(result: DualCheck<unknown>, code: DualIssueCode) {
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain(code)
}
function replaceSource(context: DualValidationContext, sourceId: string, patch: Partial<DualSource>) {
  context.sources = context.sources.map((source) => source.id === sourceId ? { ...source, ...patch } : source)
}
function move(envelope: DualManagerEnvelope, context: DualValidationContext, sourceId = 'p'): Extract<DualOperation, { type: 'moveScene' }> {
  return { type: 'moveScene', destinationId: 'shop', hours: 0, stayingIds: [], stage: 'agreed', evidenceIds: [proof(envelope, context, sourceId)] }
}
function note(context: DualValidationContext): DualNoteEntry {
  return { id: 'old', createdTurnId: turnId, updatedTurnId: turnId, category: 'preference', status: 'reported',
    subjects: [{ kind: 'player' }], factId: null, content: 'Prefers red.', supersedesId: null,
    receipts: [{ turnId, messageIndex: 0, role: 'user', start: 0, end: 4, quote: 'Red.', speaker: { kind: 'player' }, witnessIds: [context.scene.loveInterestId] }] }
}
function freeze(value: object) {
  Object.freeze(value)
  for (const nested of Object.values(value)) if (nested && typeof nested === 'object' && !Object.isFrozen(nested)) freeze(nested)
}

describe('pure Manager validation', () => {
  it('accepts no changes without mutating a frozen snapshot', () => {
    const context = setup()
    const original = structuredClone(context)
    freeze(context)
    expect(accepted(check(empty(), context))).toMatchObject({ operationCandidates: [], informationWitnessIds: [], requiresConsistencyReview: true })
    expect(context).toEqual(original)
  })

  it('rejects a stale turn ID', () => {
    const context = setup()
    context.turnId = '22222222-2222-4222-8222-222222222222'
    rejected(check(empty(), context), 'stale-turn')
  })

  it('rejects unknown sources, forged quotations, and case-normalized evidence', () => {
    const context = setup(), envelope = empty()
    proof(envelope, context)
    rejected(check({ ...envelope, evidence: [{ ...envelope.evidence[0], sourceId: 'secret-prompt' }] }, context), 'evidence-source')
    rejected(check({ ...envelope, evidence: [{ ...envelope.evidence[0], quote: envelope.evidence[0].quote.toLowerCase() }] }, context), 'evidence-span')
  })

  it('accepts whole Unicode characters but rejects offsets splitting a surrogate pair', () => {
    const context = setup(), envelope = empty()
    replaceSource(context, 'p', { text: 'A😀B' })
    proof(envelope, context, 'p', 1, 3)
    accepted(check(envelope, context))
    rejected(check({ ...envelope, evidence: [{ ...envelope.evidence[0], end: 2, quote: '\uD83D' }] }, context), 'evidence-span')
  })

  it('uses source IDs safely even when an ID resembles an object prototype property', () => {
    const context = setup(), envelope = empty()
    context.sources = [{ ...context.sources[1], id: '__proto__' }]
    proof(envelope, context, '__proto__')
    accepted(check(envelope, context))
  })

  it('rejects duplicate registry IDs, unknown witnesses, and invented Writer player attribution', () => {
    for (const change of [
      (context: DualValidationContext) => { context.sources = [context.sources[0], context.sources[0]] },
      (context: DualValidationContext) => replaceSource(context, 'w', { witnessIds: ['outsider'] }),
      (context: DualValidationContext) => replaceSource(context, 'w', { speaker: { kind: 'player' } })
    ]) { const context = setup(); change(context); rejected(check(empty(), context), 'context') }
  })

  it('requires current player evidence for agreed movement, without treating a quote as semantic proof', () => {
    const context = setup(), envelope = empty()
    envelope.operations.push(move(envelope, context))
    const before = structuredClone(context)
    freeze(context)
    expect(accepted(check(envelope, context)).requiresConsistencyReview).toBe(true)
    expect(context).toEqual(before)
    const invented = empty()
    invented.operations.push(move(invented, context, 'w'))
    rejected(check(invented, context), 'agency')
    const historical = empty()
    historical.operations.push(move(historical, context, 'h'))
    rejected(check(historical, context), 'evidence-current')
  })

  it('keeps an invitation out of actionable effects', () => {
    const context = setup(), envelope = empty()
    envelope.operations.push({ ...move(envelope, context, 'w'), stage: 'invited' } as DualOperation)
    expect(accepted(check(envelope, context)).operationCandidates).toEqual([])
  })

  it('binds an engine-recorded player action to the exact destination, delay, and cast', () => {
    const context = setup(), envelope = empty()
    replaceSource(context, 'c', { playerAction: { type: 'moveScene', destinationId: 'shop', hours: 0, stayingIds: [] } })
    envelope.operations.push(move(envelope, context, 'c'))
    accepted(check(envelope, context))
    replaceSource(context, 'c', { playerAction: { type: 'moveScene', destinationId: 'home', hours: 0, stayingIds: [] } })
    rejected(check(envelope, context), 'agency')
    replaceSource(context, 'c', { playerAction: undefined })
    rejected(check(envelope, context), 'agency')
  })

  it.each(['missing', 'SHOP', 'home'])('rejects an unavailable or noncanonical destination %s', (destinationId) => {
    const context = setup(), envelope = empty()
    envelope.operations.push({ ...move(envelope, context), destinationId } as DualOperation)
    rejected(check(envelope, context), 'game-rule')
  })

  it('checks schedules and scene restrictions using existing rules', () => {
    for (const restriction of ['mask', 'dance', 'clash'] as const) {
      const context = setup(), envelope = empty()
      if (restriction === 'mask') context.scene.mask = { maskId: 'test', revealed: false }
      if (restriction === 'dance') context.scene.dance = true
      if (restriction === 'clash') context.state.appointments = [{ id: 'due', loveInterestId: 'ana', companionIds: [], title: 'Meeting', time: 1, hours: 2, locationId: 'home' }]
      envelope.operations.push({ ...move(envelope, context), hours: restriction === 'clash' ? 1 : 0 })
      rejected(check(envelope, context), 'game-rule')
    }
  })

  it('deduplicates identical movement and rejects conflicting or mutually exclusive travel', () => {
    const context = setup(), envelope = empty()
    const operation = move(envelope, context)
    envelope.operations = [operation, structuredClone(operation)]
    expect(accepted(check(envelope, context)).operationCandidates).toHaveLength(1)
    envelope.operations.push({ ...operation, hours: 1 } as DualOperation)
    rejected(check(envelope, context), 'conflict')
    const other = empty()
    other.operations = [move(other, context), { type: 'sleepOver', stage: 'invited', evidenceIds: [proof(other, context)] }]
    rejected(check(other, context), 'conflict')
  })

  it('validates the shared next event instead of accepting an arbitrary event token', () => {
    const context = setup(), envelope = empty()
    context.state.appointments = [{ id: 'plan', loveInterestId: 'ana', companionIds: [], title: 'Study', time: 2, hours: 2, locationId: 'shop' }]
    context.nextEventOptionId = 'next-plan'
    envelope.operations = [{ type: 'walkToEvent', optionId: 'next-plan', stage: 'agreed', evidenceIds: [proof(envelope, context, 'p')] }]
    accepted(check(envelope, context))
    context.nextEventOptionId = 'different'
    rejected(check(envelope, context), 'game-rule')
  })

  it('validates a scheduled proposal and binds precomputed offers to their actual slot', () => {
    const context = setup(), envelope = empty()
    const request = { actorId: 'ana', activity: 'Tea', placeId: 'shop', companionIds: [], earliest: 'tomorrow' as const, weekday: null, timeOfDay: null }
    const proposal = proposeMeeting(context.content, context.state, 'ana', { activity: 'Tea', place: 'shop', earliest: 'tomorrow' }).proposal!
    expect(proposal).toBeDefined()
    context.meetingOffers = [{ id: 'tea', proposal }]
    envelope.operations = [{ type: 'proposeMeeting', offerId: 'tea', request, evidenceIds: [proof(envelope, context)] }]
    const before = structuredClone(context)
    freeze(context)
    accepted(check(envelope, context))
    expect(context).toEqual(before)
    rejected(check(envelope, { ...context, meetingOffers: [{ id: 'tea', proposal: { ...proposal, time: proposal.time + 1 } }] }), 'game-rule')
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], request: { ...request, actorId: 'missing' } } as DualOperation] }, context), 'actor')
  })

  it('accepts only the captured future pending meeting with current player evidence', () => {
    const context = setup(), envelope = empty()
    context.scene.proposal = { loveInterestId: 'ana', companionIds: [], title: 'Tea', locationId: 'shop', time: 2, hours: 2 }
    context.pendingProposalRef = 'pending-tea'
    envelope.operations = [{ type: 'acceptMeeting', proposalRef: 'pending-tea', evidenceIds: [proof(envelope, context, 'p')] }]
    accepted(check(envelope, context))
    rejected(check(envelope, { ...context, pendingProposalRef: 'other' }), 'game-rule')
    const writerOnly = empty()
    writerOnly.operations = [{ type: 'acceptMeeting', proposalRef: 'pending-tea', evidenceIds: [proof(writerOnly, context)] }]
    rejected(check(writerOnly, context), 'agency')
    rejected(check(envelope, { ...context, state: { ...context.state, time: 2 } }), 'game-rule')
  })

  it('checks bond membership and existing-bond termination without forming a bond', () => {
    const context = setup(), envelope = empty()
    envelope.operations = [{ type: 'proposeBond', statusId: 'dating', memberIds: ['ana'], evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    expect(context.state.bonds).toEqual([])
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], statusId: 'none' } as DualOperation] }, context), 'game-rule')
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], memberIds: ['outsider'] } as DualOperation] }, context), 'actor')
  })

  it('validates departures, prevents everyone leaving, and detects incompatible staying lists', () => {
    const context = setup(true), envelope = empty()
    envelope.operations = [{ type: 'leaveScene', actorIds: ['ana'], feeling: 'content', reason: 'Class.', evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], actorIds: ['ana', 'bea'] } as DualOperation] }, context), 'actor')
    envelope.operations.push({ ...move(envelope, context), stayingIds: ['bea'] } as DualOperation)
    rejected(check(envelope, context), 'conflict')
    const solo = setup(), alone = empty()
    alone.operations = [{ type: 'leaveScene', actorIds: ['ana'], feeling: 'content', reason: '', evidenceIds: [proof(alone, solo)] }]
    rejected(check(alone, solo), 'actor')
  })

  it('does not promise attendance for a silent companion or unknown event', () => {
    const context = setup(true), envelope = empty()
    expect(attendableEvents(context.content, context.state).some((event) => event.id === 'feast')).toBe(true)
    envelope.operations = [{ type: 'attendEvent', eventId: 'feast', actorIds: ['ana'], evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], actorIds: ['bea'] } as DualOperation] }, context), 'evidence-attribution')
    rejected(check({ ...envelope, operations: [{ ...envelope.operations[0], eventId: 'missing' } as DualOperation] }, context), 'game-rule')
  })

  it('validates sleep and closure without settling the night or changing time', () => {
    const context = setup(), envelope = empty()
    context.state.time = 14
    envelope.operations = [{ type: 'sleepOver', stage: 'agreed', evidenceIds: [proof(envelope, context, 'p')] }, { type: 'endScene', evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    expect(context.state.time).toBe(14)
    rejected(check(envelope, { ...context, state: { ...context.state, time: 0 } }), 'game-rule')
    const playerOnly = empty()
    playerOnly.operations = [{ type: 'endScene', evidenceIds: [proof(playerOnly, context, 'p')] }]
    rejected(check(playerOnly, context), 'evidence-attribution')
  })

  it('requires character evidence for birth-control choices and never writes the existing core memory', () => {
    const context = setup(), envelope = empty()
    replaceSource(context, 'w', { text: 'Ana: I will stop my birth control.' })
    envelope.operations = [{ type: 'stopBirthControl', actorId: 'ana', evidenceIds: [proof(envelope, context)] }]
    const before = structuredClone(context)
    freeze(context)
    accepted(check(envelope, context))
    expect(context).toEqual(before)
    const requested = empty()
    requested.operations = [{ type: 'stopBirthControl', actorId: 'ana', evidenceIds: [proof(requested, context, 'p')] }]
    rejected(check(requested, context), 'evidence-attribution')
  })

  it('uses the existing intimacy gate and deduplicates potential events without rolling outcomes', () => {
    const context = setup(), envelope = empty()
    const operation: DualOperation = { type: 'potentialConception', actorId: 'ana', evidenceIds: [proof(envelope, context)] }
    envelope.operations = [operation, structuredClone(operation)]
    rejected(check(envelope, context), 'game-rule')
    context.scene.uninhibited = ['ana']
    const before = structuredClone(context)
    freeze(context)
    expect(accepted(check(envelope, context)).operationCandidates).toHaveLength(1)
    expect(context).toEqual(before)
  })

  it('keeps ordinary NPC restrictions while allowing normal scene closure', () => {
    const context = setup(), envelope = empty()
    context.scene.npc = true
    envelope.operations = [{ type: 'endScene', evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    envelope.operations.push(move(envelope, context))
    rejected(check(envelope, context), 'actor')
  })

  it('holds all effects when the Manager reports a conflict or missing context', () => {
    const context = setup(), envelope = empty()
    envelope.operations.push(move(envelope, context))
    envelope.review = [{ code: 'ambiguous-action', operationIndex: 0, reason: 'Two possible offers.', evidenceIds: [] }]
    rejected(check(envelope, context), 'review')
    expect(context.state.locationId).toBe('home')
  })

  it('does not generate proposals from eligibility context or the player alone', () => {
    const context = setup()
    for (const sourceId of ['c', 'p']) {
      const envelope = empty()
      envelope.operations = [{ type: 'proposeBond', statusId: 'dating', memberIds: ['ana'], evidenceIds: [proof(envelope, context, sourceId)] }]
      rejected(check(envelope, context), sourceId === 'c' ? 'evidence-current' : 'evidence-attribution')
    }
    const emptyEvidence = empty()
    emptyEvidence.operations = [{ type: 'endScene', evidenceIds: [] }]
    rejected(check(emptyEvidence, context), 'evidence-current')
  })

  it('rejects current-source audiences that include an already departed character', () => {
    const context = setup(true)
    context.scene.companionIds = []
    context.scene.departed = [{ id: 'bea', at: 1, feeling: 'content', reason: '' }]
    rejected(check(empty(), context), 'context')
  })
})

describe('presentation and disclosure validation', () => {
  it('checks owned appearance/reaction IDs and permits ordinary harmless face defaults', () => {
    const context = setup(), envelope = empty()
    envelope.presentation = [{ type: 'appearance', actorId: 'ana', outfitId: null, expression: 'happy', evidenceIds: [] },
      { type: 'reaction', actorId: 'ana', reactionId: 'laugh', evidenceIds: [proof(envelope, context)] }]
    accepted(check(envelope, context))
    rejected(check({ ...envelope, presentation: [{ ...envelope.presentation[0], expression: 'made-up' } as typeof envelope.presentation[number]] }, context), 'asset')
    rejected(check({ ...envelope, presentation: [{ ...envelope.presentation[1], reactionId: '../voice.ogg' } as typeof envelope.presentation[number]] }, context), 'asset')
    rejected(check({ ...envelope, presentation: [{ type: 'appearance', actorId: 'ana', outfitId: 'default', expression: null, evidenceIds: [] }] }, context), 'evidence-attribution')
  })

  it('validates state-affecting poses under the same gate, including explicit stop', () => {
    const context = setup(), envelope = empty()
    envelope.presentation = [{ type: 'pose', actorId: 'ana', animationId: 'creampie', evidenceIds: [proof(envelope, context)] }]
    rejected(check(envelope, context), 'asset')
    context.scene.uninhibited = ['ana']
    accepted(check(envelope, context))
    accepted(check({ ...envelope, presentation: [{ ...envelope.presentation[0], animationId: null } as typeof envelope.presentation[number]] }, context))
    rejected(check({ ...envelope, presentation: [{ ...envelope.presentation[0], animationId: 'outside-file' } as typeof envelope.presentation[number]] }, context), 'asset')
  })

  it('preserves comfort as an assessment and rejects conflicting duplicates', () => {
    const context = setup(), envelope = empty()
    envelope.comfort = [{ actorId: 'ana', level: 1, reason: 'Class soon.', evidenceIds: [] }]
    accepted(check(envelope, context))
    expect(context.scene.comfort).toBeUndefined()
    rejected(check({ ...envelope, comfort: [...envelope.comfort, { ...envelope.comfort[0], level: 4 }] }, context), 'conflict')
    rejected(check(envelope, { ...context, scene: { ...context.scene, npc: true } }), 'actor')
  })

  it('requires outfit changes to be supported by the right character and deduplicates faces', () => {
    const context = setup(), envelope = empty()
    const appearance = { type: 'appearance' as const, actorId: 'ana', outfitId: 'default', expression: 'happy', evidenceIds: [proof(envelope, context)] }
    envelope.presentation = [appearance, structuredClone(appearance)]
    expect(accepted(check(envelope, context)).envelope.presentation).toHaveLength(1)
    const unsupported = empty()
    unsupported.presentation = [{ ...appearance, evidenceIds: [proof(unsupported, context, 'p')] }]
    rejected(check(unsupported, context), 'evidence-attribution')
  })

  it('derives note audiences by intersection and preserves the prior version on a private correction', () => {
    const context = setup(true), envelope = empty()
    const old = note(context)
    context.informationTargets = [old]
    context.sources = [...context.sources, { id: 'private', kind: 'writer', text: 'Ana: Blue, actually.', currentTurn: true,
      speaker: { kind: 'character', id: 'ana' }, witnessIds: ['ana'] }]
    envelope.information = [{ action: 'supersede', targetEntryId: 'old', category: 'preference', status: 'reported',
      subjects: [{ kind: 'player' }], factId: null, content: 'Prefers blue.', evidenceIds: [proof(envelope, context, 'p'), proof(envelope, context, 'private')] }]
    const before = structuredClone(context)
    freeze(context)
    expect(accepted(check(envelope, context)).informationWitnessIds).toEqual([['ana']])
    expect(context).toEqual(before)
    rejected(check(envelope, { ...context, informationTargets: [] }), 'information-target')
  })

  it('does not turn private author context or historical text into new disclosures', () => {
    for (const sourceId of ['c', 'h']) {
      const context = setup(), envelope = empty()
      envelope.information = [{ action: 'record', targetEntryId: null, category: 'fact', status: 'reported', subjects: [], factId: null,
        content: 'A claim.', evidenceIds: [proof(envelope, context, sourceId)] }]
      rejected(check(envelope, context), 'evidence-current')
    }
  })

  it('keeps historical quote privacy when a new note also cites a public current disclosure', () => {
    const context = setup(true), envelope = empty()
    replaceSource(context, 'h', { witnessIds: ['ana'] })
    envelope.information = [{ action: 'record', targetEntryId: null, category: 'fact', status: 'reported', subjects: [{ kind: 'player' }],
      factId: null, content: 'A combined claim.', evidenceIds: [proof(envelope, context, 'p'), proof(envelope, context, 'h')] }]
    expect(accepted(check(envelope, context)).informationWitnessIds).toEqual([['ana']])
  })

  it('validates a promise resolution as a candidate without rewriting the earlier version', () => {
    const context = setup(), envelope = empty()
    const old = { ...note(context), category: 'promise' as const, status: 'agreed' as const, content: 'Bring a book.' }
    context.informationTargets = [old]
    replaceSource(context, 'p', { text: 'I brought the book.' })
    envelope.information = [{ action: 'resolve', targetEntryId: 'old', category: 'promise', status: 'completed', subjects: [{ kind: 'player' }],
      factId: null, content: 'Brought the book.', evidenceIds: [proof(envelope, context, 'p')] }]
    accepted(check(envelope, context))
    expect(old.status).toBe('agreed')
    expect(old.content).toBe('Bring a book.')
  })

  it('validates discoveries without granting them, and distinguishes player speculation', () => {
    const context = setup(), envelope = empty()
    replaceSource(context, 'w', { text: 'Ana: I like tea.' })
    envelope.information = [{ action: 'record', targetEntryId: null, category: 'discovery', status: 'reported', subjects: [{ kind: 'character', id: 'ana' }],
      factId: 'like:tea', content: 'Ana likes tea.', evidenceIds: [proof(envelope, context)] }]
    const before = structuredClone(context)
    freeze(context)
    accepted(check(envelope, context))
    expect(context).toEqual(before)
    rejected(check({ ...envelope, information: [{ ...envelope.information[0], factId: 'secret:0' }] }, context), 'information-fact')
    const guessed = empty()
    guessed.information = [{ ...envelope.information[0], evidenceIds: [proof(guessed, context, 'p')] }]
    rejected(check(guessed, context), 'evidence-attribution')
  })

  it('rejects unknown subjects and mismatched correction categories', () => {
    const context = setup(), envelope = empty()
    context.informationTargets = [note(context)]
    envelope.information = [{ action: 'supersede', targetEntryId: 'old', category: 'fact', status: 'reported',
      subjects: [{ kind: 'character', id: 'missing' }], factId: null, content: 'A claim.', evidenceIds: [proof(envelope, context)] }]
    rejected(check(envelope, context), 'subject')
    rejected(check(envelope, context), 'information-target')
  })
})

describe('the dormant Writer display guard', () => {
  it.each(transitionBaseline.scenarios.filter((scenario) => scenario.commandVisible))('holds the synthetic legacy leak $id without stripping it into dialogue', (scenario) => {
    expect(validateDualWriterReply(scenario.visibleText)).toMatchObject({ ok: false, issues: [{ code: 'writer-control' }] })
  })

  it.each(['[END SCENE]', '［EXPRESSION： happy］', '[COMFORT: 3 fine]', '[STOPS BIRTH CONTROL: Ana]', '[SEX-ACT: none]',
    '[LEAVES: Ana=content class]', '[SEEDED', '[AGREED]', '[ATTENDING: feast]', '[REACTS: laugh]', '[COMFassessing the room]',
    '<tool_call>{}</tool_call>', '{"schemaVersion":1,"operations":[]}', '<think>unfinished',
    '{"arguments":{"place":"shop"},"name":"move_scene"}', '{"operations":[],"schemaVersion":1}',
    '{"type":"moveScene","destinationId":"shop"}', '{MOVE: shop}', '{END SCENE}'])('holds recognized controls: %s', (text) => {
    expect(validateDualWriterReply(`Hello.\n${text}`)).toMatchObject({ ok: false, issues: [{ code: 'writer-control' }] })
  })

  it.each(['I wrote [meet after class] in my notebook.', 'The formula is {a} + {b}.',
    'My badge says {"name":"Ana"}.', 'We discussed move_scene in class.',
    'The example was {"name":"Ana","topic":"move_scene"}.'])('preserves ordinary brackets, braces, and prose: %s', (text) => {
    expect(validateDualWriterReply(text)).toMatchObject({ ok: true, value: { text } })
  })

  it('uses the existing beats and speaker attribution after canonical newline normalization', () => {
    const checked = validateDualWriterReply('Ana: Hello.\r\n*She waves.*', { cast: [{ id: 'ana', name: 'Ana' }] })
    expect(checked).toMatchObject({ ok: true, value: { text: 'Ana: Hello.\n*She waves.*', beats: [
      { text: 'Hello.', speakerId: 'ana', action: false }, { text: 'She waves.', action: true }
    ] } })
  })

  it('ignores only a leading separated reasoning block and rejects fabricated player speaker labels', () => {
    expect(validateDualWriterReply('<think>draft</think>\nHello.')).toMatchObject({ ok: true, value: { text: 'Hello.' } })
    expect(validateDualWriterReply('Pat: I agree.', { playerName: 'Pat' })).toMatchObject({ ok: false, issues: [{ code: 'agency' }] })
    expect(validateDualWriterReply('Pat (Jr.): I agree.', { playerName: 'Pat (Jr.)' })).toMatchObject({ ok: false, issues: [{ code: 'agency' }] })
  })

  it('bounds output and rejects provider tool-call metadata even beside harmless prose', () => {
    expect(validateDualWriterReply('  ')).toMatchObject({ ok: false, issues: [{ code: 'writer-empty' }] })
    expect(validateDualWriterReply('a'.repeat(12_001))).toMatchObject({ ok: false, issues: [{ code: 'writer-size' }] })
    expect(validateDualWriterReply(Array(33).fill('Hello.').join('\n'))).toMatchObject({ ok: false, issues: [{ code: 'writer-size' }] })
    expect(validateDualWriterReply('Hello.', { toolCalls: [{}] })).toMatchObject({ ok: false, issues: [{ code: 'writer-control' }] })
  })
})
