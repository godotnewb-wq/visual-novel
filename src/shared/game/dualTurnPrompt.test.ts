import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage, t } from '../i18n'
import zhScene from '../../../content/zh-CN/strings/scene.json'
import { AnimationSchema, type Scene } from '../model'
import { fixture } from './testFixture'
import { createInitialState } from './state'
import { sceneBaseline } from './scene'
import { buildCharacterPrompt } from './prompt'
import { buildDualManagerPrompt, buildDualWriterPrompt, dualManagerJsonSchema, prepareDualPromptInput, withDualWriterSources, type DualPromptInput } from './dualTurnPrompt'
import { validateDualManagerReply, validateDualWriterReply } from './dualTurnValidation'

const turnId = '11111111-1111-4111-8111-111111111111'
function input(group = false): DualPromptInput {
  const content = fixture()
  content.loveInterests[0].birthControl = true
  content.loveInterests[0].animations = [AnimationSchema.parse({ id: 'kiss', name: 'Kiss', description: 'A warm kiss.', image: 'private/pose.png' })]
  if (group) content.loveInterests.push({ ...content.loveInterests[0], id: 'bea', name: 'Bea' })
  const state = createInitialState(content), companionIds = group ? ['bea'] : []
  const scene: Scene = { loveInterestId: 'ana', companionIds, npc: false, nsfw: false, messages: [{ role: 'assistant', content: 'Hello.', tags: '[COMFORT: 4]' }, { role: 'user', content: 'Good day.', cue: 'Someone arrives.' }],
    beats: [{ activityName: 'Talk' }], gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana', companionIds) }
  return { context: { content, state, scene, turnId, sources: [{ id: 'player', kind: 'player', text: 'Good day.', currentTurn: true, speaker: { kind: 'player' }, witnessIds: ['ana', ...companionIds] }] } }
}
afterEach(() => setLanguage('en'))
describe('separate Writer and Manager prompts', () => {
  it.each([false, true])('retains character and scene context without generated control duties (group=%s)', (group) => {
    const source = input(group), prompt = buildDualWriterPrompt(source)
    expect(prompt.system).toContain('Dry and watchful.')
    expect(prompt.system).toContain('Speaks in riddles.')
    expect(prompt.system).toContain('Is secretly a dragon.')
    expect(prompt.system).toContain('shop')
    expect(prompt.system).toContain("Leave the player's words, actions, and feelings to the player.")
    expect(prompt.system).not.toMatch(/\[(?:COMFORT|EXPRESSION|OUTFIT|SEX-ACT|LEAVES|SEEDED|AGREED|ENDSCENE|SLEEP|ATTENDING|STOPS BIRTH CONTROL)\b/)
    expect(prompt.system).not.toMatch(/\b(?:move_scene|propose_meeting|propose_relationship)\b/)
    expect(JSON.stringify(prompt.messages)).not.toContain('[COMFORT: 4]')
    expect(prompt.messages.at(-1)?.content).toContain('[Someone arrives.]')
    expect(prompt.messages.at(-1)?.content).toContain('Good day.')
    expect(prompt.system).toContain('birth control')
  })
  it('keeps the default Legacy prompt and user-authored instructions intact', () => {
    const source = input(), { content, state, scene } = source.context
    const legacy = buildCharacterPrompt({ content, state, loveInterestId: 'ana', look: scene, sceneBeats: scene.beats })
    expect(legacy).toContain('[EXPRESSION: happy]'); expect(legacy).toContain('move_scene')
    content.loveInterests[0].ai.extraInstructions = 'My custom [OUTFIT: default] instruction.'
    expect(buildDualWriterPrompt(source).system).toContain('My custom [OUTFIT: default] instruction.')
  })
  it('retains lecture knowledge and the teacher opening cue', () => {
    const source = input()
    source.context.scene.lesson = { speaker: 'Professor Reed', course: 'Riddles (RID 101)', about: 'How riddles work.', topic: { title: 'Beginnings', content: 'A riddle invites a question.' } }
    source.context.scene.messages = []
    const prompt = buildDualWriterPrompt(source)
    expect(prompt.system).toContain('A riddle invites a question.')
    expect(prompt.messages[0].content).toContain('Professor Reed')
    expect(prompt.system).toContain('180 words')
  })
  it('handles NPC prompt context without romance control syntax', () => {
    const source = input(); source.context.scene.npc = true
    source.hints = { npc: { role: 'Librarian', knowledge: ['Find a book on the shelf.'] } }
    const prompt = buildDualWriterPrompt(source)
    expect(prompt.system).toContain('Find a book on the shelf.')
    expect(prompt.system).not.toContain('[COMFORT')
    expect(JSON.parse(buildDualManagerPrompt(source).messages[0].content).options.destinations).toEqual([])
  })
  it('uses localized role instructions and reminders', () => {
    setLanguage('zh-CN', Object.fromEntries(Object.entries(zhScene).map(([key, value]) => [`scene.${key}`, value])))
    expect(buildDualWriterPrompt(input()).system).toContain('只写对话和叙述')
    expect(buildDualManagerPrompt(input()).system).toContain('准确的UTF-16文本区间')
    expect(t('scene.dual.reminder', { lines: '2–4', words: 60, named: true })).toContain('标明每位说话者')
  })
  it('projects identifiers and observations without duplicating Writer secrets or media paths', () => {
    const source = input(), writer = buildDualWriterPrompt(source), manager = buildDualManagerPrompt(source)
    const payload = JSON.parse(manager.messages[0].content)
    expect(payload.cast[0]).toMatchObject({ id: 'ana', outfits: [{ id: 'default', name: 'Dress' }], poses: [{ id: 'kiss', name: 'Kiss' }], onBirthControl: true })
    expect(manager.system).toContain('"schemaVersion"')
    expect(manager.messages[0].content).not.toContain(writer.system)
    expect(manager.messages[0].content).not.toContain('Is secretly a dragon.')
    expect(manager.messages[0].content).not.toContain('private/pose.png')
    expect(payload.cast[0].discoverableFacts).not.toContain('secret:0')
    expect(dualManagerJsonSchema.type).toBe('object')
  })
  it('bounds history without guessing who heard it or truncating evidence sources', () => {
    const source = input()
    for (let index = 0; index < 10; index++) source.context.sources = [...source.context.sources, { id: `history:${index}`, kind: 'history', currentTurn: false, text: 'x'.repeat(3000), speaker: null, witnessIds: [] }]
    const payload = JSON.parse(buildDualManagerPrompt(source).messages[0].content)
    const history = payload.sources.filter((entry: { kind: string }) => entry.kind === 'history')
    expect(history).toHaveLength(4)
    expect(history.every((entry: { text: string; witnessIds: string[] }) => entry.text.length === 3000 && entry.witnessIds.length === 0)).toBe(true)
  })
  it('preflights requested meetings before local alternatives and retains pending references without acceptance', () => {
    const source = input(), before = structuredClone(source)
    source.meetingRequests = [{ actorId: 'ana', placeId: 'home', activity: 'Tea tomorrow', companionIds: [], earliest: 'tomorrow', weekday: null, timeOfDay: null }]
    const prepared = prepareDualPromptInput(source)
    expect(prepared.context.meetingOffers?.[0].proposal).toMatchObject({ title: 'Tea tomorrow', locationId: 'home' })
    expect(prepared.context.meetingOffers!.length).toBeLessThanOrEqual(12)
    expect(source.context).toEqual(before.context)
    const offer = prepared.context.meetingOffers![0].proposal
    source.context.scene.proposal = offer
    const pending = prepareDualPromptInput(source)
    expect(pending.context.pendingProposalRef).toBe(`proposal:${turnId}`)
    expect(pending.context.scene.proposal).toEqual(offer)
    expect(source.context.state.appointments).toEqual([])
  })
  it('registers exact canonical Writer text and keeps a teacher distinct from narration', () => {
    const source = input(), written = validateDualWriterReply('Professor Reed: I stopped taking birth control.\n*Ana smiles.*', {
      cast: source.context.content.loveInterests, voices: ['Professor Reed']
    })
    if (!written.ok) throw new Error('Expected prose')
    const context = withDualWriterSources(source.context, written.value), teacher = context.sources.find((entry) => entry.id === 'writer:0')!
    expect(teacher).toMatchObject({ speaker: null, speakerName: 'Professor Reed', text: 'Professor Reed: I stopped taking birth control.', witnessIds: ['ana'] })
    expect(written.value.text.slice(teacher.replyRange!.start, teacher.replyRange!.end)).toBe(teacher.text)
    const envelope = { schemaVersion: 1, turnId, evidence: [{ id: 'proof', sourceId: teacher.id, start: 0, end: teacher.text.length, quote: teacher.text }],
      operations: [{ type: 'stopBirthControl', actorId: 'ana', evidenceIds: ['proof'] }], presentation: [], comfort: [], information: [], review: [] }
    const checked = validateDualManagerReply(JSON.stringify(envelope), context)
    expect(checked.ok).toBe(false)
    if (!checked.ok) expect(checked.issues).toContainEqual({ code: 'evidence-attribution', path: ['operations', 0] })
    expect(context.sources.find((entry) => entry.id === 'writer:1')?.text).toBe('*Ana smiles.*')
  })
})
