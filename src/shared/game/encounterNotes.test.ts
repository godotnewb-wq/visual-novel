import { describe, expect, it } from 'vitest'
import { SceneSchema, type Scene } from '../model'
import { fixture } from './testFixture'
import { createInitialState } from './state'
import { sceneBaseline } from './scene'
import { characterNotes, initialiseSceneGeneration, managerNoteTargets, NOTE_VIEW_LIMITS, reconcileEncounterNotes, stageWitnesses, visibleNoteVersions, witnessedAt } from './encounterNotes'
import type { DualNoteEntry } from './dualTurnContract'
import { buildSummaryPrompt, buildSpendingPrompt } from './memory'
import { buildDualWriterPrompt } from './dualTurnPrompt'
import { dualSceneSources } from './dualSources'
import { createGameSession, prepareDualCheckpoint, reduceGameSession, saveGameSession } from './dualSession'
import { SaveDataSchema } from '../saves'

const id = '11111111-1111-4111-8111-111111111111'
function setup() {
  const content = fixture(), state = createInitialState(content)
  content.loveInterests.push({ ...content.loveInterests[0], id: 'bea', name: 'Bea' })
  const scene: Scene = initialiseSceneGeneration({ loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false, messages: [],
    gifts: [], conceived: [], departed: [], beats: [{ activityName: 'Tea' }], baseline: sceneBaseline(state, 'ana', []) }, 'dual', id)
  return { content, state, scene }
}
function note(name: string, witnesses = ['ana', 'bea'], category: DualNoteEntry['category'] = 'promise', status: DualNoteEntry['status'] = 'agreed', parent: string | null = null): DualNoteEntry {
  return { id: name, category, status, subjects: [{ kind: 'player' }], factId: null, content: `Claim ${name}.`,
    createdTurnId: id, updatedTurnId: id, supersedesId: parent, receipts: [{ turnId: id, messageIndex: 0, role: 'user', start: 0, end: 4, quote: 'Tea.', speaker: { kind: 'player' }, witnessIds: witnesses }] }
}
function entries(scene: Scene) { if (scene.generation?.mode !== 'dual') throw new Error('Expected Dual'); return scene.generation.ledger.entries }
function withEntries(scene: Scene, list: DualNoteEntry[]) {
  if (scene.generation?.mode !== 'dual') throw new Error('Expected Dual')
  return { ...scene, generation: { ...scene.generation, ledger: { ...scene.generation.ledger, entries: list } } }
}

describe('encounter note knowledge and retention', () => {
  it('preserves the original promise when only one witness hears its resolution', () => {
    const { scene } = setup(), original = note('original'), resolved = note('resolution', ['ana'], 'promise', 'completed')
    const before = withEntries(scene, [original])
    const after = reconcileEncounterNotes(before, [{ action: 'resolve', targetEntryId: original.id, entry: resolved }])
    expect(entries(after)).toHaveLength(2); expect(entries(before)[0]).toEqual(original)
    expect(visibleNoteVersions(entries(after), 'ana').map((entry) => entry.id)).toEqual(['resolution'])
    expect(visibleNoteVersions(entries(after), 'bea').map((entry) => entry.id)).toEqual(['original'])
  })
  it('keeps private correction text and audience out of the unaware character view', () => {
    const { content, scene } = setup(), old = note('old', ['ana', 'bea'], 'preference', 'reported')
    old.content = 'Likes tea.'
    const correction = { ...note('correction', ['ana'], 'preference', 'reported'), content: 'Prefers private dragon tea.' }
    const after = reconcileEncounterNotes(withEntries(scene, [old]), [{ action: 'supersede', targetEntryId: 'old', entry: correction }])
    expect(characterNotes(content, after, 'bea').map((entry) => entry.content)).toEqual(['Likes tea.'])
    expect(characterNotes(content, after, 'ana').map((entry) => entry.content)).toEqual(['Prefers private dragon tea.'])
  })
  it('requires every supporting receipt to have been witnessed before exposing a composite claim', () => {
    const { content, scene } = setup(), combined = note('combined')
    combined.receipts.push({ ...combined.receipts[0], witnessIds: ['ana'] })
    const saved = withEntries(scene, [combined])
    expect(characterNotes(content, saved, 'bea')).toEqual([])
    expect(characterNotes(content, saved, 'ana')).toHaveLength(1)
  })
  it('evicts fully superseded versions first without making an older private claim reappear', () => {
    const { scene } = setup(), old = note('old'), middle = note('middle', ['ana', 'bea'], 'promise', 'agreed', 'old')
    const latest = note('latest', ['ana', 'bea'], 'promise', 'agreed', 'middle')
    const list = [old, middle, latest, ...Array.from({ length: 125 }, (_, index) => note(`p${index}`))]
    const after = reconcileEncounterNotes(withEntries(scene, list), [{ action: 'record', targetEntryId: null, entry: note('new', ['ana'], 'preference', 'reported') }])
    expect(entries(after)).toHaveLength(128)
    expect(visibleNoteVersions(entries(after), 'ana').some((entry) => entry.id === 'old' || entry.id === 'middle')).toBe(false)
    expect(entries(after).some((entry) => entry.id === 'latest')).toBe(true)
  })
  it('pins a private resolution while its still-needed old promise would otherwise resurface', () => {
    const { scene } = setup(), old = note('old'), closed = note('closed', ['ana'], 'promise', 'completed', 'old')
    const list = [old, closed, ...Array.from({ length: 126 }, (_, index) => note(`p${index}`))]
    const after = reconcileEncounterNotes(withEntries(scene, list), [{ action: 'record', targetEntryId: null, entry: note('optional', ['ana'], 'fact', 'reported') }])
    expect(entries(after).some((entry) => entry.id === 'closed')).toBe(true)
    expect(entries(after).some((entry) => entry.id === 'old')).toBe(true)
    expect(entries(after).some((entry) => entry.id === 'optional')).toBe(false)
    expect(after.generation?.mode === 'dual' && after.generation.ledger.trackingLimited).toBe(true)
  })
  it('continues without evicting an unresolved commitment when no safe slot exists', () => {
    const { scene } = setup(), list = Array.from({ length: 128 }, (_, index) => note(`p${index}`))
    const after = reconcileEncounterNotes(withEntries(scene, list), [{ action: 'record', targetEntryId: null, entry: note('new') }])
    expect(entries(after)).toEqual(list)
    expect(after.generation?.mode === 'dual' && after.generation.ledger.droppedCandidates).toBe(1)
  })
  it('deduplicates exact evidence and repeated optional claims without merging audiences or separate commitments', () => {
    const { scene } = setup(), original = note('old', ['ana'], 'preference', 'reported')
    const repeated = { ...original, id: 'repeat', content: `  ${original.content.toUpperCase()}  `, receipts: [{ ...original.receipts[0], messageIndex: 9 }] }
    const after = reconcileEncounterNotes(withEntries(scene, [original]), [{ action: 'record', targetEntryId: null, entry: repeated }])
    expect(entries(after)).toHaveLength(1)
    const privateOther = { ...repeated, id: 'other', receipts: [{ ...repeated.receipts[0], witnessIds: ['bea'] }] }
    expect(entries(reconcileEncounterNotes(after, [{ action: 'record', targetEntryId: null, entry: privateOther }]))).toHaveLength(2)
    const promise = note('promise'), separate = { ...promise, id: 'separate', receipts: [{ ...promise.receipts[0], messageIndex: 9 }] }
    expect(entries(reconcileEncounterNotes(withEntries(scene, [promise]), [{ action: 'record', targetEntryId: null, entry: separate }]))).toHaveLength(2)
  })
  it('retains removed-content notes in saves while omitting them from valid prompt targets', () => {
    const { content, scene } = setup(), removed = note('removed')
    removed.subjects = [{ kind: 'character', id: 'missing-character' }]
    const saved = withEntries(scene, [removed])
    expect(characterNotes(content, saved, 'ana')).toEqual([]); expect(managerNoteTargets(content, saved)).toEqual([])
    expect(entries(saved)).toEqual([removed])
  })
  it('bounds views by both serialized size and count, retaining unresolved plans ahead of optional claims', () => {
    const { content, scene } = setup(), list = Array.from({ length: 30 }, (_, index) => note(`n${index}`, ['ana'], index === 0 ? 'plan' : 'fact', index === 0 ? 'agreed' : 'reported'))
    const view = characterNotes(content, withEntries(scene, list), 'ana')
    expect(view.length).toBeLessThanOrEqual(NOTE_VIEW_LIMITS.characterNotes)
    expect(view.reduce((sum, entry) => sum + JSON.stringify(entry).length, 0)).toBeLessThanOrEqual(NOTE_VIEW_LIMITS.characterCharacters)
    expect(view.some((entry) => entry.id === 'n0')).toBe(true)
    expect(managerNoteTargets(content, withEntries(scene, list)).length).toBeLessThanOrEqual(12)
  })
})

describe('witness boundaries, prompts, and resumed scenes', () => {
  it('records arrival boundaries and gives a departing actor the entire departure reply', () => {
    const { scene } = setup()
    scene.messages = [{ role: 'user', content: 'Private first line.' }, { role: 'assistant', content: 'Ana: Private reply.' }]
    const joined = stageWitnesses({ ...scene, companionIds: ['bea'] }, 2)
    joined.messages = [...joined.messages, { role: 'user', content: 'Hello both.' }, { role: 'assistant', content: 'Ana: Goodbye.\nBea: Hello.' }]
    expect(witnessedAt(joined, 0)).toEqual(['ana']); expect(witnessedAt(joined, 2)).toEqual(['ana', 'bea'])
    if (joined.generation?.mode !== 'dual') throw new Error('Expected Dual')
    joined.generation.witnesses = joined.generation.witnesses!.map((range) => range.actorId === 'ana' ? { ...range, toMessage: 4 } : range)
    joined.messages.push({ role: 'assistant', content: 'Bea: A later private reply.' })
    expect(witnessedAt(joined, 3)).toContain('ana'); expect(witnessedAt(joined, 4)).toEqual(['bea'])
    expect(SceneSchema.safeParse(joined).success).toBe(true)
  })
  it('does not reconstruct unknown old audiences from the current cast', () => {
    const { scene } = setup(); if (scene.generation?.mode !== 'dual') throw new Error('Expected Dual')
    delete scene.generation.witnesses
    scene.messages = [{ role: 'assistant', content: 'Old private statement.' }]
    const continued = stageWitnesses(scene, 1)
    expect(witnessedAt(continued, 0)).toEqual([])
  })
  it('keeps private history out of a latecomer summary and Writer history, including old activity labels', () => {
    const { content, state, scene } = setup()
    scene.messages = [{ role: 'user', content: 'Private dragon discussion.' }, { role: 'assistant', content: 'Ana: The secret is a dragon.' }]
    scene.beats[0].activityName = 'Private dragon activity'
    const joined = stageWitnesses({ ...scene, loveInterestId: 'bea', companionIds: [], departed: [{ id: 'ana', at: 2, feeling: 'content', reason: '' }] }, 2)
    joined.messages.push({ role: 'user', content: 'Tea.' }, { role: 'assistant', content: 'Bea: Tea is ready.' })
    const summary = buildSummaryPrompt({ content, state, scene: joined, forId: 'bea' })
    expect(summary.user).not.toContain('dragon'); expect(summary.user).toContain('Tea is ready')
    const prompt = buildDualWriterPrompt({ context: { content, state, scene: joined, turnId: id, sources: [] } })
    expect(JSON.stringify(prompt.messages)).not.toContain('dragon')
    expect(prompt.system).not.toContain('Private dragon activity')
    expect(buildSpendingPrompt(content, state, joined).user).toContain('dragon')
  })
  it('shows each character only their own correction version in summaries', () => {
    const { content, state, scene } = setup()
    scene.messages = [{ role: 'user', content: 'Tea.' }]
    const old = { ...note('old'), content: 'Bring red tea.' }, newer = { ...note('new', ['ana'], 'promise', 'withdrawn', 'old'), content: 'The private red tea plan is cancelled.' }
    const saved = withEntries(scene, [old, newer])
    expect(buildSummaryPrompt({ content, state, scene: saved, forId: 'bea' }).user).not.toContain('is cancelled')
    expect(buildSummaryPrompt({ content, state, scene: saved, forId: 'ana' }).user).toContain('is cancelled')
  })
  it('persists membership and assessments through save/resume and restores them through undo', () => {
    const { content, state, scene } = setup(), initial = createGameSession({ state, scene })
    const pending = prepareDualCheckpoint(content, initial, id, 'revision', { text: 'Tea.' })
    const before = reduceGameSession(initial, { type: 'begin', pending })
    const after = reduceGameSession(before, { type: 'commit', content, ready: { turnId: id, sceneId: id, revision: 0, contentRevision: 'revision', effects: {
      message: { role: 'assistant', content: 'Ana: Tea.' }, profileId: 'writer', managerProfileId: 'manager', profileRole: 'writer', systemPrompt: '', sceneEnded: false,
      look: {}, looks: {}, comfort: { ana: { level: 2, reason: 'Uneasy.' } }, contacts: [], seededIds: [], offControlIds: [], voices: [], rolls: [], noteChanges: [] } } })
    const saved = createGameSession(SaveDataSchema.parse(JSON.parse(JSON.stringify(saveGameSession(after)))))
    expect(saved.scene!.generation).toEqual(after.scene!.generation)
    if (saved.scene!.generation?.mode !== 'dual') throw new Error('Expected Dual')
    expect(saved.scene!.generation.comfortHistory?.ana).toEqual([{ level: 2, reason: 'Uneasy.' }])
    expect(dualSceneSources({ content, state, scene: saved.scene!, turnId: id }).every((source) => source.witnessIds.includes('ana'))).toBe(true)
    expect(reduceGameSession(saved, { type: 'rewind', turnsBack: 1 }).scene!.generation).toEqual(scene.generation)
  })
  it('keeps an open scene pinned to its mode and only initializes unmarked new scenes with the preference', () => {
    const { scene } = setup()
    expect(initialiseSceneGeneration(scene, 'legacy', 'ignored')).toBe(scene)
    const legacy = { ...scene, generation: undefined }
    expect(initialiseSceneGeneration(legacy, 'legacy', id).generation?.mode).toBe('legacy')
    expect(initialiseSceneGeneration(legacy, 'dual', id).generation?.mode).toBe('dual')
  })
})
