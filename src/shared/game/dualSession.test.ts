import { describe, expect, it } from 'vitest'
import { AnimationSchema, PregnancyConfigSchema, RelationshipStatusSchema, SceneSchema, type ContentPack, type Scene } from '../model'
import { SaveDataSchema } from '../saves'
import { createInitialState } from './state'
import { fixture } from './testFixture'
import { sceneBaseline } from './scene'
import { createGameSession, dialogueScene, prepareDualCheckpoint, reduceGameSession, saveGameSession, type DualReady, type GameSession } from './dualSession'
import { buildDualTurnEffects, type DualTurnEffects } from './dualTurnEffects'
import { prepareDualPromptInput, withDualWriterSources } from './dualTurnPrompt'
import { proposeMeeting } from './appointments'
import { validateDualManagerReply, validateDualWriterReply, type DualValidationContext } from './dualTurnValidation'
import { DUAL_TURN_LIMITS, type DualManagerEnvelope, type DualNoteEntry } from './dualTurnContract'
import { dualSceneSources } from './dualSources'
import { KEPT_ACROSS, rewound } from './turns'
import { resumeSavedGame } from './resume'
import { hasContact } from './courier'

const sceneId = '11111111-1111-4111-8111-111111111111', turnId = '22222222-2222-4222-8222-222222222222'
function setup(group = false) {
  const content = fixture(), state = createInitialState(content)
  content.loveInterests[0].birthControl = true
  content.loveInterests[0].animations = [AnimationSchema.parse({ id: 'creampie', name: 'Finish', image: 'a.png' })]
  content.loveInterests[0].reactions = { laugh: 'laugh.ogg' }
  if (group) content.loveInterests.push({ ...content.loveInterests[0], id: 'bea', name: 'Bea' })
  state.relationships.ana = { affection: 80, desire: 100, trust: 0 }
  if (group) state.relationships.bea = { affection: 80, desire: 100, trust: 0 }
  const companionIds = group ? ['bea'] : []
  const scene: Scene = { loveInterestId: 'ana', companionIds, npc: false, nsfw: false, messages: [{ role: 'assistant', content: 'Hello.' }],
    gifts: [], conceived: [], departed: [], beats: [{ activityName: 'Talk' }], baseline: sceneBaseline(state, 'ana', companionIds),
    generation: { schemaVersion: 1, mode: 'dual', sceneId, lastCommittedTurnId: null, nextTurnOrdinal: 1,
      ledger: { entries: [], trackingLimited: false, droppedCandidates: 0 }, completion: { kind: 'continue' } } }
  return { content, session: createGameSession({ state, scene }) }
}
function staged(content: ContentPack, session: GameSession, text = 'Hello.') {
  return reduceGameSession(session, { type: 'begin', pending: prepareDualCheckpoint(content, session, turnId, 'content:1', { text }) })
}
function effects(content: ContentPack, session: GameSession, reply = 'Ana: Hello there.', edit: (envelope: DualManagerEnvelope, proof: (source: string) => string) => void = () => {}) {
  const pending = session.pending!
  const base = { turnId: pending.turnId, content, state: pending.state, scene: pending.asked }
  const parsed = validateDualWriterReply(reply, { cast: content.loveInterests, playerName: pending.state.player.name })
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues))
  const context: DualValidationContext = withDualWriterSources(prepareDualPromptInput({ context: { ...base, sources: dualSceneSources(base) } }).context, parsed.value)
  const envelope: DualManagerEnvelope = { schemaVersion: 1, turnId: pending.turnId, evidence: [], operations: [], presentation: [], comfort: [], information: [], review: [] }
  const proof = (id: string) => {
    const source = context.sources.find((source) => source.id === id)!, evidenceId = `e${envelope.evidence.length}`
    envelope.evidence.push({ id: evidenceId, sourceId: id, start: 0, end: source.text.length, quote: source.text }); return evidenceId
  }
  edit(envelope, proof)
  const manager = validateDualManagerReply(JSON.stringify(envelope), context)
  if (!manager.ok) throw new Error(JSON.stringify(manager.issues))
  const built = buildDualTurnEffects(context, parsed.value, manager.value, { writerProfileId: 'writer', managerProfileId: 'manager', writerUsedNsfw: false })
  if (!built.ok) throw new Error(JSON.stringify(built.issues))
  return built.value
}
const ready = (response: DualTurnEffects): DualReady => ({ turnId, sceneId, revision: 0, contentRevision: 'content:1', effects: response })
function commit(content: ContentPack, session: GameSession, response = effects(content, session)) {
  return reduceGameSession(session, { type: 'commit', content, ready: { ...ready(response), revision: session.revision } })
}
function note(index: number, category: DualNoteEntry['category'] = 'promise'): DualNoteEntry {
  return { id: `old:${index}`, category, status: 'agreed', subjects: [{ kind: 'player' }], factId: null, content: `Bring book ${index}.`,
    createdTurnId: sceneId, updatedTurnId: sceneId, supersedesId: null,
    receipts: [{ turnId: sceneId, role: 'assistant', messageIndex: 0, start: 0, end: 5, quote: 'Hello', speaker: null, witnessIds: ['ana'] }] }
}

describe('atomic Dual turn application', () => {
  it('keeps pending text, preparation, and undo out of the committed frame and saves', () => {
    const { content, session } = setup(), pending = staged(content, session)
    expect(pending.state).toBe(session.state); expect(pending.scene).toBe(session.scene); expect(pending.turns).toEqual([])
    expect(pending.pending!.asked.messages).toHaveLength(2)
    expect(saveGameSession(pending)).toEqual(saveGameSession(session))
  })
  it('commits dialogue, effects, metadata, and one undo record together, once', () => {
    const { content, session } = setup(), pending = staged(content, session)
    const response = effects(content, pending, 'Ana: Hello there.', (envelope) => { envelope.comfort.push({ actorId: 'ana', level: 4, reason: 'Welcome', evidenceIds: [] }) })
    const after = commit(content, pending, response)
    expect(after.scene!.messages).toHaveLength(3); expect(after.scene!.messages.at(-1)).toEqual({ role: 'assistant', content: 'Ana: Hello there.' })
    expect(after.scene!.comfort?.ana.level).toBe(4); expect(after.turns).toHaveLength(1); expect(after.pending).toBeUndefined()
    expect(after.scene!.generation).toMatchObject({ lastCommittedTurnId: turnId, nextTurnOrdinal: 2 })
    expect(reduceGameSession(after, { type: 'commit', content, ready: ready(response) })).toBe(after)
  })
  it.each(['turnId', 'sceneId', 'revision', 'contentRevision'] as const)('rejects a result with stale %s without changing anything', (field) => {
    const { content, session } = setup(), pending = staged(content, session), candidate = ready(effects(content, pending))
    const stale = { ...candidate, [field]: field === 'revision' ? 99 : 'stale' }
    expect(reduceGameSession(pending, { type: 'commit', content, ready: stale })).toBe(pending)
  })
  it('cancels a pending turn while retaining already committed gifts, money, and plans', () => {
    const { content, session } = setup()
    session.state = { ...session.state, player: { ...session.state.player, money: 23 } }
    session.scene = { ...session.scene!, gifts: [{ name: 'Book', description: 'A gift.', reaction: 'liked', recipientId: 'ana' }] }
    const pending = staged(content, session), after = reduceGameSession(pending, { type: 'cancel', turnId })
    expect(after.state).toBe(session.state); expect(after.scene).toBe(session.scene); expect(after.turns).toEqual([])
    expect(reduceGameSession(after, { type: 'commit', content, ready: ready(effects(content, pending)) })).toBe(after)
  })
  it('stages arrivals without meeting them or spending their arrival marker on cancellation', () => {
    const { content, session } = setup(true)
    session.scene = { ...session.scene!, companionIds: [], drama: { actorId: 'bea', kind: 'friend', afterLines: 0, fired: false, reasons: ['A friend.'] } }
    const pending = staged(content, session)
    expect(pending.pending!.asked.companionIds).toContain('bea')
    expect(dialogueScene(pending)!.companionIds).toEqual([])
    expect(dialogueScene(pending)!.drama!.fired).toBe(false)
    expect(dialogueScene(pending)!.messages.at(-1)!.role).toBe('user')
    expect(pending.scene!.companionIds).toEqual([]); expect(pending.state.dramaDay).toBe(session.state.dramaDay)
    const cancelled = reduceGameSession(pending, { type: 'cancel', turnId })
    expect(cancelled.scene!.drama!.fired).toBe(false)
    const after = commit(content, pending)
    expect(after.scene!.drama!.fired).toBe(true); expect(after.scene!.companionIds).toContain('bea')
  })
  it('merges every independently arriving background field and keeps newly given contacts', () => {
    const { content, session } = setup(), pending = staged(content, session)
    const response = effects(content, pending, 'Ana: My handle is @ana.')
    const background = { ...pending.state, feedDay: 12, newsDay: 12, newsReported: ['new'] }
    const arrived = reduceGameSession(pending, { type: 'set', field: 'state', value: background })
    const after = commit(content, arrived, response)
    expect(after.state.feedDay).toBe(12); expect(after.state.newsDay).toBe(12)
    expect(hasContact(after.state, 'ana')).toBe(true)
    const undone = rewound(after.turns[0], after.state)
    for (const key of KEPT_ACROSS) expect(undone[key]).toBe(after.state[key])
  })
  it('blocks foreground mutations while allowing background updates without invalidating the turn', () => {
    const { content, session } = setup(), pending = staged(content, session)
    const changed = reduceGameSession(pending, { type: 'set', field: 'state', value: { ...pending.state, time: 99, feedDay: 5 } })
    expect(changed.state.time).toBe(pending.state.time); expect(changed.state.feedDay).toBe(5); expect(changed.revision).toBe(pending.revision)
    expect(reduceGameSession(changed, { type: 'set', field: 'scene', value: null })).toBe(changed)
    expect(reduceGameSession(changed, { type: 'set', field: 'turns', value: [] })).toBe(changed)
  })
  it('defers video completion on cancel and never clears a newly committed pose', () => {
    const { content, session } = setup(); session.scene = { ...session.scene!, animationId: 'old', animationOf: 'ana' }
    const pending = staged(content, session), finished = reduceGameSession(pending, { type: 'animationEnded' })
    expect(finished.scene!.animationId).toBe('old')
    expect(reduceGameSession(finished, { type: 'cancel', turnId }).scene!.animationId).toBeUndefined()
    const response = effects(content, pending); response.look = { animationId: 'new', animationOf: 'ana' }
    const committed = commit(content, finished, response)
    expect(committed.scene!.animationId).toBe('new')
    expect(reduceGameSession(committed, { type: 'rewind', turnsBack: 1 }).scene!.animationId).toBeUndefined()
  })
  it('clears an omitted transient pose while retaining the existing outfit and expression', () => {
    const { content, session } = setup(); session.scene = { ...session.scene!, animationId: 'old', outfitId: 'default', expression: 'happy' }
    const after = commit(content, staged(content, session))
    expect(after.scene).toMatchObject({ outfitId: 'default', expression: 'happy' }); expect(after.scene!.animationId).toBeUndefined()
  })
  it('applies birth-control memory and one conception before movement/time', () => {
    const { content, session } = setup()
    content.pregnancy = PregnancyConfigSchema.parse({ chance: 1, birthControlChance: 0, periodDays: 0, birthLocationId: 'shop',
      stages: [{ id: 'early', name: 'Early', from: 0, description: 'Early pregnancy.' }] })
    const pending = staged(content, session, "Let's go to the shop.")
    const response = effects(content, pending, 'Ana: I stopped taking birth control.\n*Ana smiles.*', (envelope, proof) => {
      const evidenceIds = [proof('writer:0')]
      envelope.operations.push({ type: 'stopBirthControl', actorId: 'ana', evidenceIds }, { type: 'potentialConception', actorId: 'ana', evidenceIds },
        { type: 'moveScene', destinationId: 'shop', stayingIds: [], hours: 2, stage: 'agreed', evidenceIds: [proof('player')] })
      envelope.presentation.push({ type: 'pose', actorId: 'ana', animationId: 'creampie', evidenceIds })
    })
    expect(response.seededIds).toEqual(['ana'])
    const after = commit(content, pending, response)
    expect(after.state.offBirthControl).toContain('ana'); expect(after.state.memories.ana).toHaveLength(1)
    expect(after.state.pregnancies.ana.conceivedAt).toBe(session.state.time)
    expect(after.state.time).toBe(session.state.time + 2); expect(after.state.locationId).toBe('shop')
    expect(after.scene!.conceived).toEqual(['ana'])
  })
  it('keeps the entire departure reply, changes lead, and marks those left behind', () => {
    const { content, session } = setup(true), pending = staged(content, session, "Let's go to the shop.")
    const response = effects(content, pending, 'Ana: Go with Bea.\nBea: Come along.', (envelope, proof) => {
      envelope.operations.push({ type: 'moveScene', destinationId: 'shop', stayingIds: ['ana'], hours: 0, stage: 'agreed', evidenceIds: [proof('player')] })
      envelope.presentation.push({ type: 'appearance', actorId: 'bea', outfitId: null, expression: 'happy', evidenceIds: [] })
    })
    const after = commit(content, pending, response)
    expect(after.scene!.loveInterestId).toBe('bea'); expect(after.scene!.expression).toBe('happy')
    expect(after.scene!.departed[0]).toMatchObject({ id: 'ana', at: 3, behind: true })
    expect(after.scene!.messages.at(-1)!.content).toContain('Bea: Come along.')
  })
  it('keeps movement departure precedence regardless of Manager operation ordering', () => {
    const { content, session } = setup(true), pending = staged(content, session, "Let's go to the shop.")
    const build = (reverse: boolean) => effects(content, pending, 'Ana: Go on without me.', (envelope, proof) => {
      envelope.operations.push({ type: 'moveScene', destinationId: 'shop', hours: 0, stayingIds: ['ana'], stage: 'agreed', evidenceIds: [proof('player')] },
        { type: 'leaveScene', actorIds: ['ana'], feeling: 'content', reason: 'A written reason.', evidenceIds: [proof('writer:0')] })
      if (reverse) envelope.operations.reverse()
    })
    expect(build(false).left).toEqual(build(true).left)
    expect(build(false).left!.reason).not.toBe('A written reason.')
  })
  it('records evidence-backed notes with correct raw-message offsets and undoes them', () => {
    const { content, session } = setup(), pending = staged(content, session)
    const response = effects(content, pending, 'Ana: I prefer tea.\n*Ana smiles.*', (envelope, proof) => {
      envelope.information.push({ action: 'record', targetEntryId: null, category: 'preference', status: 'reported', subjects: [{ kind: 'character', id: 'ana' }],
        factId: null, content: 'Prefers tea.', evidenceIds: [proof('writer:0')] })
    })
    const after = commit(content, pending, response), generation = after.scene!.generation!
    if (generation.mode !== 'dual') throw new Error('Expected Dual scene')
    const receipt = generation.ledger.entries[0].receipts[0]
    expect(after.scene!.messages[receipt.messageIndex].content.slice(receipt.start, receipt.end)).toBe(receipt.quote)
    expect(receipt.witnessIds).toEqual(['ana'])
    expect(after.turns[0].scene.generation).toEqual(session.scene!.generation)
    expect(SaveDataSchema.safeParse(saveGameSession(after)).success).toBe(true)
    const corrupt = structuredClone(saveGameSession(after))
    if (corrupt.scene?.generation?.mode !== 'dual') throw new Error('Expected Dual scene')
    corrupt.scene.generation.ledger.entries[0].receipts[0].quote = 'Forged quotation'
    expect(SaveDataSchema.safeParse(corrupt).success).toBe(false)
  })
  it('rewinds completion, notes, identity, state, and scene atomically while retaining background deliveries', () => {
    const { content, session } = setup(), pending = staged(content, session), response = effects(content, pending)
    response.sceneEnded = true; response.walkTo = { withIds: ['ana'] }
    const after = commit(content, pending, response)
    after.state = { ...after.state, feedDay: 88 }
    const undone = reduceGameSession(after, { type: 'rewind', turnsBack: 1 })
    expect(undone.ended).toBe(false); expect(undone.walkingWith).toBeNull(); expect(undone.sleepingOver).toBe(false)
    expect(undone.scene!.generation).toEqual(session.scene!.generation); expect(undone.state.feedDay).toBe(88)
    expect(undone.turns).toEqual([])
    expect(reduceGameSession(after, { type: 'rewind', turnsBack: 99 })).toBe(after)
  })
  it.each(['continue', 'end', 'sleep', 'walk'] as const)('round-trips metadata, completion (%s), and undo through a real save parse/resume', (kind) => {
    const { content, session } = setup(), pending = staged(content, session), response = effects(content, pending)
    response.sceneEnded = kind !== 'continue'; response.sleptOver = kind === 'sleep'; response.walkTo = kind === 'walk' ? { withIds: ['ana'] } : undefined
    const after = commit(content, pending, response), saved = SaveDataSchema.parse(JSON.parse(JSON.stringify(saveGameSession(after))))
    const resumed = createGameSession(resumeSavedGame(content, saved))
    expect(resumed.scene).toEqual(after.scene); expect(resumed.ended).toBe(kind !== 'continue')
    expect(resumed.walkingWith).toEqual(after.walkingWith); expect(resumed.sleepingOver).toBe(after.sleepingOver)
    expect(resumed.turns[0].scene.generation).toEqual(session.scene!.generation)
    expect(rewound(resumed.turns[0], resumed.state).time).toBe(session.state.time)
  })
  it('retains old save behavior and rejects corrupt optional Dual metadata', () => {
    const { session } = setup(), scene = { ...session.scene! }; delete scene.generation
    expect(SaveDataSchema.parse({ state: session.state, scene }).scene!.generation).toBeUndefined()
    expect(SceneSchema.safeParse({ ...scene, generation: { mode: 'dual' } }).success).toBe(false)
    expect(createGameSession({ state: session.state, scene }).ended).toBe(false)
  })
  it('creates proposal and bond cards without booking or agreeing to either one', () => {
    const { content, session } = setup()
    content.relationships.statuses = [RelationshipStatusSchema.parse({ id: 'dating', name: 'Dating' })]
    const pending = staged(content, session)
    const response = effects(content, pending, 'Ana: We could meet for tea.\nAna: Could we date?', (envelope, proof) => {
      envelope.operations.push({ type: 'proposeMeeting', offerId: null, request: { actorId: 'ana', activity: 'Tea', placeId: 'home',
        companionIds: [], earliest: null, weekday: null, timeOfDay: null }, evidenceIds: [proof('writer:0')] },
      { type: 'proposeBond', statusId: 'dating', memberIds: ['ana'], evidenceIds: [proof('writer:1')] })
    })
    const after = commit(content, pending, response)
    expect(after.scene!.proposal).toMatchObject({ title: 'Tea', locationId: 'home' })
    expect(after.scene!.bondProposal).toEqual({ statusId: 'dating', memberIds: ['ana'] })
    expect(after.state.appointments).toEqual([]); expect(after.state.bonds).toEqual(session.state.bonds)
  })
  it('books an accepted pending proposal exactly once, with existing same-place precedence', () => {
    const { content, session } = setup()
    const proposal = proposeMeeting(content, session.state, 'ana', { activity: 'Original tea', place: 'home' }).proposal!
    session.scene = { ...session.scene!, proposal }
    const pending = staged(content, session, 'Yes, that plan works.')
    const response = effects(content, pending, 'Ana: Tea it is.', (envelope, proof) => {
      envelope.operations.push({ type: 'acceptMeeting', proposalRef: `proposal:${turnId}`, evidenceIds: [proof('player')] },
        { type: 'proposeMeeting', offerId: null, request: { actorId: 'ana', activity: 'Replacement tea', placeId: 'home',
          companionIds: [], earliest: null, weekday: null, timeOfDay: null }, evidenceIds: [proof('writer:0')] })
    })
    const after = commit(content, pending, response)
    expect(after.state.appointments).toHaveLength(1); expect(after.state.appointments[0].title).toBe('Original tea')
    expect(after.scene!.proposal).toBeUndefined()
  })
  it('records attendance without travelling and resolves a reaction asset only from its owner', () => {
    const { content, session } = setup()
    content.calendar.events = content.calendar.events.map((event) => ({ ...event, startHour: 8, locationId: 'shop' }))
    const pending = staged(content, session), eventId = content.calendar.events[0].id
    const response = effects(content, pending, 'Ana: I will attend the Feast.', (envelope, proof) => {
      envelope.operations.push({ type: 'attendEvent', eventId, actorIds: ['ana'], evidenceIds: [proof('writer:0')] })
      envelope.presentation.push({ type: 'reaction', actorId: 'ana', reactionId: 'laugh', evidenceIds: [proof('writer:0')] })
    })
    const after = commit(content, pending, response)
    expect(after.state.eventGoers[eventId]).toEqual(['ana']); expect(after.state.locationId).toBe(session.state.locationId)
    expect(response.voices).toEqual(['laugh.ogg'])
  })
  it('closes for a shared event without teleporting or advancing time', () => {
    const { content, session } = setup()
    session.state.appointments = [{ id: 'tea', loveInterestId: 'ana', companionIds: [], title: 'Tea', time: 2, hours: 1, locationId: 'shop' }]
    const pending = staged(content, session, "Let's go to our tea appointment.")
    const response = effects(content, pending, 'Ana: Come along.', (envelope, proof) => {
      envelope.operations.push({ type: 'walkToEvent', optionId: `next:${turnId}`, stage: 'agreed', evidenceIds: [proof('player')] })
    })
    const after = commit(content, pending, response)
    expect(after.ended).toBe(true); expect(after.walkingWith).toEqual(['ana']); expect(after.state.time).toBe(session.state.time)
    expect(after.state.locationId).toBe(session.state.locationId)
  })
  it('records sleep completion without applying overnight settlement before the existing summary flow', () => {
    const { content, session } = setup(); session.state = { ...session.state, time: 14 }
    const pending = staged(content, session, "Let's sleep here.")
    const response = effects(content, pending, 'Ana: Good night.', (envelope, proof) => {
      envelope.operations.push({ type: 'sleepOver', stage: 'agreed', evidenceIds: [proof('player')] })
    })
    const after = commit(content, pending, response)
    expect(after.ended).toBe(true); expect(after.sleepingOver).toBe(true); expect(after.state.time).toBe(14)
  })
  it('resolves and corrects notes without changing the saved undo snapshot', () => {
    const { content, session } = setup(), generation = session.scene!.generation!
    if (generation.mode !== 'dual') throw new Error('Expected Dual scene')
    generation.ledger.entries = [note(0), note(1)]
    const pending = staged(content, session), response = effects(content, pending)
    response.noteChanges = [
      { action: 'resolve', targetEntryId: 'old:0', entry: { ...note(0), id: 'resolved', status: 'completed', content: 'Brought the book.', updatedTurnId: turnId } },
      { action: 'supersede', targetEntryId: 'old:1', entry: { ...note(2), id: 'new', supersedesId: 'old:1', content: 'Bring another book.' } }
    ]
    const after = commit(content, pending, response), next = after.scene!.generation!
    if (next.mode !== 'dual') throw new Error('Expected Dual scene')
    expect(next.ledger.entries.find((entry) => entry.id === 'old:0')!.status).toBe('agreed')
    expect(next.ledger.entries.find((entry) => entry.id === 'resolved')).toMatchObject({ status: 'completed', supersedesId: 'old:0' })
    expect(next.ledger.entries.find((entry) => entry.id === 'new')!.supersedesId).toBe('old:1')
    expect(after.turns[0].scene.generation).toEqual(generation)
    expect(generation.ledger.entries[0].status).toBe('agreed')
  })
  it('keeps departure witnesses on notes while never attributing old history to a new arrival', () => {
    const { content, session } = setup(true), pending = staged(content, session)
    const response = effects(content, pending, 'Ana: I prefer tea.\nAna: Goodbye.', (envelope, proof) => {
      envelope.information.push({ action: 'record', targetEntryId: null, category: 'preference', status: 'reported', subjects: [{ kind: 'character', id: 'ana' }],
        factId: null, content: 'Prefers tea.', evidenceIds: [proof('writer:0')] })
      envelope.operations.push({ type: 'leaveScene', actorIds: ['ana'], feeling: 'content', reason: '', evidenceIds: [proof('writer:1')] })
    })
    expect(response.noteChanges[0].entry.receipts[0].witnessIds).toEqual(['ana', 'bea'])
    const old = dualSceneSources({ turnId, content, state: pending.state, scene: pending.pending!.asked }).find((source) => source.kind === 'history')!
    expect(old.witnessIds).toEqual([])
  })
  it.each(['*Ana leads you into the shop.*', 'Ana: I stopped taking birth control.', '*Ana strips naked.*', '*Ana leaves.*', '*You smile.*', '*Pat grabs her hand.*', 'Ana: Meet me at 23:15 tomorrow.'])('holds known prose/state contradictions: %s', (reply) => {
    const { content, session } = setup(), pending = staged(content, session)
    expect(() => effects(content, pending, reply)).toThrow('consistency')
    expect(pending.scene!.messages).toHaveLength(1)
  })
  it('permits a supported pending meeting time and holds an unsupported exact promise', () => {
    const { content, session } = setup()
    const proposal = proposeMeeting(content, session.state, 'ana', { activity: 'Tea', place: 'home' }).proposal!
    session.scene = { ...session.scene!, proposal }
    const hour = (6 + proposal.time) % content.calendar.hoursPerDay
    const pending = staged(content, session)
    expect(effects(content, pending, `Ana: Shall we meet at ${String(hour).padStart(2, '0')}:00?`).sceneEnded).toBe(false)
    expect(() => effects(content, pending, `Ana: We will meet at ${String(hour).padStart(2, '0')}:30.`)).toThrow('consistency')
  })
  it('does not turn an invitation into movement or falsely hold a neutral invitation', () => {
    const { content, session } = setup(), pending = staged(content, session)
    const response = effects(content, pending, 'Ana: Would you like to visit the shop?')
    expect(response.moveTo).toBeUndefined(); expect(commit(content, pending, response).state.locationId).toBe('home')
  })
  it('keeps normal NPC dialogue but rejects NPC romantic operations', () => {
    const { content, session } = setup(); session.scene = { ...session.scene!, npc: true }
    const pending = staged(content, session)
    expect(effects(content, pending, 'Ana: Here is your book.').contacts).toEqual([])
    expect(() => effects(content, pending, 'Ana: I will stop.', (envelope, proof) => {
      envelope.operations.push({ type: 'stopBirthControl', actorId: 'ana', evidenceIds: [proof('writer:0')] })
    })).toThrow()
  })
  it('continues at capacity, evicts resolved notes first, and marks limited tracking for pinned promises', () => {
    for (const removable of [true, false]) {
      const { content, session } = setup(), generation = session.scene!.generation!
      if (generation.mode !== 'dual') throw new Error('Expected Dual scene')
      generation.ledger.entries = Array.from({ length: DUAL_TURN_LIMITS.notes }, (_, index) => note(index))
      if (removable) generation.ledger.entries[17].status = 'completed'
      const pending = staged(content, session), response = effects(content, pending)
      response.noteChanges.push({ action: 'record', targetEntryId: null, entry: { ...note(999, 'preference'), id: 'new' } })
      const after = commit(content, pending, response), next = after.scene!.generation!
      if (next.mode !== 'dual') throw new Error('Expected Dual scene')
      expect(next.ledger.entries).toHaveLength(128); expect(next.ledger.entries.some((entry) => entry.id === 'new')).toBe(removable)
      expect(next.ledger.trackingLimited).toBe(!removable); expect(after.scene!.messages).toHaveLength(3)
    }
  })
})
