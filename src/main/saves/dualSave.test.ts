import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { SaveStore } from './store'
import { fixture } from '../../shared/game/testFixture'
import { createInitialState } from '../../shared/game/state'
import { sceneBaseline } from '../../shared/game/scene'
import { resumeSavedGame } from '../../shared/game/resume'
import { createGameSession, prepareDualCheckpoint, reduceGameSession, saveGameSession } from '../../shared/game/dualSession'
import type { DualTurnEffects } from '../../shared/game/dualTurnEffects'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
describe('Dual save compatibility on disk', () => {
  it('writes only the committed checkpoint during a pending turn, then preserves notes and undo across restart', () => {
    const root = mkdtempSync(join(tmpdir(), 'bh-dual-save-')); roots.push(root)
    const store = new SaveStore(root), content = fixture(), state = createInitialState(content)
    const sceneId = '11111111-1111-4111-8111-111111111111', turnId = '22222222-2222-4222-8222-222222222222'
    const initial = createGameSession({ state, scene: { loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false,
      messages: [{ role: 'assistant', content: 'Hello.' }], beats: [{ activityName: 'Talk' }], gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana', []),
      generation: { schemaVersion: 1, mode: 'dual', sceneId, lastCommittedTurnId: null, nextTurnOrdinal: 1,
        completion: { kind: 'continue' }, ledger: { entries: [], trackingLimited: false, droppedCandidates: 0 } } } })
    const pending = reduceGameSession(initial, { type: 'begin', pending: prepareDualCheckpoint(content, initial, turnId, 'revision', { text: 'Tea, please.' }) })
    store.save('slot1', saveGameSession(pending))
    expect(readFileSync(join(root, 'slot1.json'), 'utf8')).not.toContain('Tea, please.')
    const effects: DualTurnEffects = { message: { role: 'assistant', content: 'Ana: I like tea.' }, profileId: 'writer', managerProfileId: 'manager', profileRole: 'writer',
      systemPrompt: 'Not saved', sceneEnded: true, look: {}, looks: {}, comfort: {}, offControlIds: [], seededIds: [], voices: [], rolls: [], contacts: [],
      noteChanges: [{ action: 'record', targetEntryId: null, entry: { id: 'preference', category: 'preference', status: 'reported', subjects: [{ kind: 'character', id: 'ana' }],
        factId: null, content: 'Likes tea.', createdTurnId: turnId, updatedTurnId: turnId, supersedesId: null,
        receipts: [{ turnId, messageIndex: 2, role: 'assistant', start: 0, end: 16, quote: 'Ana: I like tea.', speaker: { kind: 'character', id: 'ana' }, witnessIds: ['ana'] }] } }] }
    effects.noteChanges[0].entry.receipts[0].end = effects.message.content.length
    const after = reduceGameSession(pending, { type: 'commit', content, ready: { turnId, sceneId, revision: 0, contentRevision: 'revision', effects } })
    store.save('slot1', saveGameSession(after))
    const bytes = readFileSync(join(root, 'slot1.json'), 'utf8')
    expect(bytes).not.toContain('Not saved'); expect(bytes).not.toContain('systemPrompt')
    const restarted = createGameSession(resumeSavedGame(content, new SaveStore(root).load('slot1')))
    expect(restarted.ended).toBe(true); expect(restarted.scene).toEqual(after.scene); expect(restarted.turns).toHaveLength(1)
    const undone = reduceGameSession(restarted, { type: 'rewind', turnsBack: 1 })
    store.save('slot2', saveGameSession(undone))
    expect(new SaveStore(root).load('slot2').scene!.messages).toEqual(initial.scene!.messages)
    expect(undone.scene!.generation).toEqual(initial.scene!.generation)
  })
})
