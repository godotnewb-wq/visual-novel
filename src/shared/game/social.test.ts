import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentPack } from '../../main/content/loader'
import type { GameState, Happening } from '../model'
import { tieOf } from './bonds'
import { giveContact } from './courier'
import { knownRelation, relationBetween, setRelation } from './rapport'
import { createInitialState } from './state'
import {
  buildHappeningPrompt,
  candidates,
  cliques,
  cutAtSentence,
  happeningMemory,
  hearHappening,
  parseHappeningReply,
  pendingHappenings,
  socialDue,
  socialRound,
  tellingBrief,
  writeHappening
} from './social'
import { toDate } from './calendar'

const content = loadContentPack(join(process.cwd(), 'content', 'default'))

/** A game at the hour the web is looked at on its second day, in which nobody is anybody's friend or enemy yet, so that each test sets up only what it is about. */
function fresh(seed = 1): GameState {
  const state = createInitialState(content, 'Pat', seed)
  const { hoursPerDay } = content.calendar
  let time = hoursPerDay
  while (toDate(content.calendar, time).hour !== content.social!.fromHour) time++
  return { ...state, time, rapport: Object.fromEntries(Object.keys(state.rapport).map((id) => [id, { friends: [], enemies: [], lovers: [] }])), ties: {} }
}
const feels = (state: GameState, id: string, affection: number, trust = affection, desire = 0): GameState => ({
  ...state,
  relationships: { ...state.relationships, [id]: { affection, trust, desire } },
  met: state.met.includes(id) ? state.met : [...state.met, id]
})
const tied = (state: GameState, a: string, b: string, value: number): GameState => ({ ...state, ties: { ...state.ties, [[a, b].sort().join('|')]: value } })
const kinds = (state: GameState, a: string, b: string) => candidates(content, state).filter((one) => one.ids.includes(a) && one.ids.includes(b)).map((one) => one.kind)

describe('what could happen between two of them', () => {
  it('is a friendship between two who are nothing to each other, more where they share a friend, and a feud only with a reason', () => {
    const state = fresh()
    // Faye and Tink share no class, society or friend, and neither has a temper: nothing to quarrel over.
    expect(kinds(state, 'faye', 'tink')).toEqual(['friendship'])
    const apart = candidates(content, state).find((one) => one.kind === 'friendship' && one.ids.includes('faye') && one.ids.includes('tink'))!
    // Two with a friend in common are drawn together, and have something to fall out over.
    const shared = setRelation(setRelation(state, 'faye', 'anwen', 'friends'), 'tink', 'anwen', 'friends')
    const together = candidates(content, shared).find((one) => one.kind === 'friendship' && one.ids.includes('faye') && one.ids.includes('tink'))!
    expect(together.weight).toBeGreaterThan(apart.weight)
    expect(kinds(shared, 'faye', 'tink')).toContain('feud')
    // So do two who both have a claim on him.
    expect(kinds(feels(feels(state, 'faye', 65), 'tink', 65), 'faye', 'tink')).toContain('feud')
  })

  it('is a falling-out between friends, and a spark only once they are close, and never for a prude or someone promised to him', () => {
    const friends = setRelation(fresh(), 'faye', 'tink', 'friends')
    expect(kinds(friends, 'faye', 'tink')).toContain('falling-out')
    expect(kinds(friends, 'faye', 'tink')).not.toContain('spark')
    const close = tied(friends, 'faye', 'tink', 40)
    expect(kinds(close, 'faye', 'tink')).toContain('spark')
    const prude = content.loveInterests.find((li) => li.traitIds.includes('prude'))
    if (prude) {
      const withPrude = tied(setRelation(fresh(), 'faye', prude.id, 'friends'), 'faye', prude.id, 40)
      expect(kinds(withPrude, 'faye', prude.id)).not.toContain('spark')
    }
    const promised: GameState = { ...close, bonds: [{ statusId: 'exclusive', memberIds: ['faye'], since: 0 }] }
    expect(kinds(promised, 'faye', 'tink')).not.toContain('spark')
  })

  it('is a quarrel over him when both have a claim on him', () => {
    const friends = setRelation(fresh(), 'faye', 'tink', 'friends')
    const plain = candidates(content, friends).find((one) => one.kind === 'falling-out' && one.ids.includes('faye') && one.ids.includes('tink'))!
    expect(plain.overPlayer).toBe(false)
    const both = feels(feels(friends, 'faye', 65), 'tink', 65)
    const over = candidates(content, both).find((one) => one.kind === 'falling-out' && one.ids.includes('faye') && one.ids.includes('tink'))!
    expect(over.overPlayer).toBe(true)
    expect(over.weight).toBeGreaterThan(plain.weight)
  })

  it('is a word about him only from someone with something to say, and the worst when she has been to bed with him behind a promise', () => {
    // Neither has met him: nothing to say.
    expect(kinds(fresh(), 'faye', 'tink')).not.toContain('gossip')
    const fond = feels(feels(fresh(), 'faye', 50, 50), 'tink', 10, 10)
    const praise = candidates(content, fond).find((one) => one.kind === 'gossip' && one.ids[0] === 'faye' && one.ids[1] === 'tink')
    expect(praise?.tone).toBe('praise')
    // Tink, barely knowing him and trusting him little, has only a warning to give.
    const warning = candidates(content, fond).find((one) => one.kind === 'gossip' && one.ids[0] === 'tink' && one.ids[1] === 'faye')
    expect(warning?.tone).toBe('warning')
    const betrayed: GameState = { ...fond, timesIntimate: { faye: 1 }, bonds: [{ statusId: 'exclusive', memberIds: ['tink'], since: 0 }] }
    const betrayal = candidates(content, betrayed).find((one) => one.kind === 'gossip' && one.ids[0] === 'faye' && one.ids[1] === 'tink')
    expect(betrayal?.tone).toBe('betrayal')
  })

  it('is an invitation only from two lovers who both want him and whose Bloomr he has', () => {
    const lovers = setRelation(fresh(), 'faye', 'tink', 'lovers')
    expect(kinds(lovers, 'faye', 'tink')).toContain('parting')
    expect(kinds(lovers, 'faye', 'tink')).not.toContain('invitation')
    const wanting = feels(feels(lovers, 'faye', 40, 40, 60), 'tink', 40, 40, 60)
    expect(kinds(wanting, 'faye', 'tink')).not.toContain('invitation')
    const reachable = giveContact(giveContact(wanting, 'faye'), 'tink')
    expect(kinds(reachable, 'faye', 'tink')).toContain('invitation')
    // Not when either wants him too little.
    expect(kinds(feels(reachable, 'tink', 40, 40, 10), 'faye', 'tink')).not.toContain('invitation')
  })
})

describe('the day', () => {
  it('is looked at once, from mid-morning, and goes the same way for the same game', () => {
    const state = fresh()
    expect(socialDue(content, state)).toBe(true)
    expect(socialDue(content, { ...state, time: state.time - 2 })).toBe(false)
    const after = socialRound(content, state)
    expect(after.socialDay).toBe(toDate(content.calendar, state.time).dayIndex)
    expect(socialDue(content, after)).toBe(false)
    expect(socialRound(content, state)).toEqual(after)
  })

  it('has something happen on some days and not others, and never without the web', () => {
    const days = new Set<number>()
    let state = fresh(3)
    for (let day = 0; day < 20; day++) {
      state = socialRound(content, { ...state, time: state.time + content.calendar.hoursPerDay })
      days.add(state.happenings.length)
    }
    expect(state.happenings.length).toBeGreaterThan(2)
    expect(state.happenings.length).toBeLessThan(20)
    expect(socialRound({ ...content, social: undefined }, fresh()).happenings).toEqual([])
  })

  it('applies what happened at once: who they are to each other, how they feel, and a memory each', () => {
    // Only a spark can happen between these two: everyone else is kept out of the web.
    const two = setRelation(fresh(), 'faye', 'tink', 'friends')
    const only = { ...two, relationships: { faye: two.relationships.faye, tink: two.relationships.tink } }
    const close = tied(only, 'faye', 'tink', 60)
    const sure = { ...content, social: { ...content.social!, dailyChance: 1, weights: { ...content.social!.weights, fallingOut: 0, outing: 0 } } }
    const noJealousy = { ...sure, traits: sure.traits.map((trait) => ({ ...trait, drama: { ...trait.drama, jealousy: 0 } })) }
    const after = socialRound(noJealousy, close)
    expect(after.happenings).toHaveLength(1)
    const [happening] = after.happenings
    expect(happening.kind).toBe('spark')
    expect(relationBetween(after, 'faye', 'tink')).toBe('lovers')
    expect(tieOf(content, after, 'faye', 'tink')).toBe(75)
    expect(after.memories.faye?.at(-1)?.summary).toBe(happeningMemory(content, after, happening, 'faye'))
    expect(after.memories.tink?.at(-1)?.summary).toContain('Faye')
    expect(happening.account).toContain('Faye and Tink have become lovers')
    // Nobody has his Bloomr, so nobody tells him.
    expect(happening.tellerId).toBeUndefined()
    expect(happening.heard).toBe(false)
    expect(pendingHappenings(after).map((one) => one.id)).toEqual([happening.id])
  })

  it('costs both their trust in him when they quarrel over him, and names one of them to tell him', () => {
    const friends = feels(feels(setRelation(fresh(), 'faye', 'tink', 'friends'), 'faye', 65, 50), 'tink', 65, 50)
    const only = giveContact({ ...friends, relationships: { faye: friends.relationships.faye, tink: friends.relationships.tink } }, 'faye')
    const sure = { ...content, social: { ...content.social!, dailyChance: 1, tellChance: 1, weights: { ...content.social!.weights, spark: 0, gossip: 0, outing: 0 } } }
    const after = socialRound(sure, tied(only, 'faye', 'tink', 20))
    const [happening] = after.happenings
    expect(happening.kind).toBe('falling-out')
    expect(happening.overPlayer).toBe(true)
    expect(relationBetween(after, 'faye', 'tink')).toBe('neither')
    expect(after.relationships.faye.trust).toBe(47)
    expect(after.relationships.tink.trust).toBe(47)
    expect(happening.tellerId).toBe('faye')
    expect(happening.account).toContain('over Pat')
    expect(tellingBrief(sure, after, happening)).toContain(happening.account)
  })

  it('lets two lovers ask him over, with the plan and what the scene is for', () => {
    const lovers = setRelation(fresh(), 'faye', 'tink', 'lovers')
    const wanting = giveContact(giveContact(feels(feels(lovers, 'faye', 40, 40, 60), 'tink', 40, 40, 60), 'faye'), 'tink')
    const only = { ...wanting, relationships: { faye: wanting.relationships.faye, tink: wanting.relationships.tink } }
    const sure = { ...content, social: { ...content.social!, dailyChance: 1, weights: { ...content.social!.weights, parting: 0, gossip: 0, outing: 0 } } }
    const after = socialRound(sure, only)
    const [happening] = after.happenings
    expect(happening.kind).toBe('invitation')
    expect(happening.tellerId).toBe('faye')
    expect(happening.proposal?.loveInterestId).toBe('faye')
    expect(happening.proposal?.companionIds).toEqual(['tink'])
    expect(happening.proposal?.direction).toContain('Faye and Tink are lovers')
    expect(tellingBrief(sure, after, happening)).toContain('Tink')
    // Asked once, they do not ask again for a fortnight.
    const tomorrow = { ...after, time: after.time + content.calendar.hoursPerDay }
    expect(candidates(sure, tomorrow).some((one) => one.kind === 'invitation')).toBe(false)
  })
})

describe('cliques', () => {
  it('are everyone joined by friendship or love, at most four strong, around the best-connected', () => {
    const state = fresh()
    expect(cliques(content, state, content.loveInterests.map((li) => li.id))).toEqual([])
    const pair = setRelation(state, 'faye', 'tink', 'friends')
    expect(cliques(content, pair, content.loveInterests.map((li) => li.id))).toEqual([['faye', 'tink']])
    // A chain is one circle; lovers count as friends.
    const chain = setRelation(setRelation(pair, 'tink', 'yulia', 'lovers'), 'yulia', 'anwen', 'friends')
    expect(cliques(content, chain, content.loveInterests.map((li) => li.id))).toEqual([['anwen', 'faye', 'tink', 'yulia']])
    // Six in a circle around Tink: she and her three closest go out.
    const star = ['anwen', 'daphne', 'elowen', 'faye', 'yulia'].reduce((next, id) => setRelation(next, 'tink', id, 'friends'), state)
    const close = tied(tied(tied(star, 'tink', 'daphne', 40), 'tink', 'elowen', 30), 'tink', 'anwen', 20)
    expect(cliques(content, close, content.loveInterests.map((li) => li.id))).toEqual([['anwen', 'daphne', 'elowen', 'tink']])
  })

  it('go out together of an evening, somewhere public, and come back a little closer, each with a memory of it', () => {
    const state = setRelation(setRelation(fresh(), 'faye', 'tink', 'friends'), 'tink', 'yulia', 'friends')
    const outing = candidates(content, state).find((one) => one.kind === 'outing')!
    expect(outing.ids).toEqual(['faye', 'tink', 'yulia'])
    const place = content.locations.find((l) => l.id === outing.locationId)!
    expect(place.private).toBe(false)
    expect(place.eventOnly).toBe(false)
    expect(place.id).not.toBe(content.coursework?.locationId)
    const only = { ...state, relationships: { faye: state.relationships.faye, tink: state.relationships.tink, yulia: state.relationships.yulia } }
    const sure = { ...content, social: { ...content.social!, dailyChance: 1, weights: { ...content.social!.weights, friendship: 0, feud: 0, fallingOut: 0, gossip: 0, spark: 0 } } }
    const after = socialRound(sure, only)
    const happening = after.happenings.at(-1)!
    expect(happening.kind).toBe('outing')
    expect(happening.ids).toEqual(['faye', 'tink', 'yulia'])
    expect(happening.account).toBe(`Faye, Tink and Yulia went out together last night, to ${place.name}.`)
    expect(tieOf(content, after, 'faye', 'yulia')).toBe(tieOf(content, state, 'faye', 'yulia') + 4)
    expect(after.memories.tink?.at(-1)?.summary).toContain(`Last night you and Faye and Yulia went out together to ${place.name}`)
    const { user } = buildHappeningPrompt(sure, after, happening)
    expect(user).toContain('They are a clique')
    expect(user).toContain(place.name)
  })
})

describe('allies against him', () => {
  const found = (state: GameState): GameState => ({
    ...state,
    happenings: [{ id: 'happening-0-10', kind: 'gossip', day: toDate(content.calendar, state.time).dayIndex - 1, time: 10, ids: ['faye', 'tink'], overPlayer: true, tone: 'betrayal', account: 'Faye told Tink.', written: true, heard: false }]
  })

  it('is possible only once one has found out about the other, lately, and he has her Bloomr', () => {
    const both = feels(feels(fresh(), 'faye', 50, 50), 'tink', 65, 50)
    expect(kinds(both, 'faye', 'tink')).not.toContain('alliance')
    expect(kinds(found(both), 'faye', 'tink')).not.toContain('alliance')
    const reachable = giveContact(found(both), 'tink')
    const alliance = candidates(content, reachable).find((one) => one.kind === 'alliance')
    // The one told asks him to face them.
    expect(alliance?.ids).toEqual(['tink', 'faye'])
    // Too long ago, it has gone cold.
    const cold = { ...reachable, happenings: reachable.happenings.map((one) => ({ ...one, day: one.day - 20 })) }
    expect(kinds(cold, 'faye', 'tink')).not.toContain('alliance')
  })

  it('costs them both trust, makes them friends, and asks him to face them with a plan the scene runs on', () => {
    const both = feels(feels(setRelation(fresh(), 'faye', 'tink', 'enemies'), 'faye', 50, 50), 'tink', 65, 50)
    const reachable = giveContact(found(both), 'tink')
    const only = { ...reachable, relationships: { faye: reachable.relationships.faye, tink: reachable.relationships.tink } }
    const sure = { ...content, social: { ...content.social!, dailyChance: 1, weights: { ...content.social!.weights, peace: 0, gossip: 0 } } }
    const after = socialRound(sure, only)
    const happening = after.happenings.at(-1)!
    expect(happening.kind).toBe('alliance')
    expect(happening.tellerId).toBe('tink')
    expect(happening.proposal?.companionIds).toEqual(['faye'])
    expect(happening.proposal?.direction).toContain('Tink and Faye have compared notes')
    expect(relationBetween(after, 'faye', 'tink')).toBe('friends')
    expect(after.relationships.faye.trust).toBe(44)
    expect(after.relationships.tink.trust).toBe(44)
    expect(tellingBrief(sure, after, happening)).toContain('Faye will be there')
    // Once is enough for one finding-out.
    expect(candidates(sure, { ...after, time: after.time + content.calendar.hoursPerDay }).some((one) => one.kind === 'alliance')).toBe(false)
  })
})

describe('what the LLM writes of it', () => {
  const happening: Happening = { id: 'happening-1-30', kind: 'feud', day: 1, time: 30, ids: ['faye', 'tink'], overPlayer: true, account: 'Faye and Tink have quarreled over Pat and are enemies now.', written: false, heard: false }

  it('is asked for with who they are, how they stood, and what happened', () => {
    const state = feels(fresh(), 'faye', 65)
    const { system, user } = buildHappeningPrompt(content, state, happening)
    expect(system).toContain('"faye": string')
    expect(user).toContain('Faye')
    expect(user).toContain('Tink')
    expect(user).toContain('What happened today: Faye and Tink have quarreled over Pat')
    expect(user).toContain('Faye and Pat: Dating')
  })

  it('is cut at the end of a sentence when it runs long, never mid-word', () => {
    const long = `${'Grushka warned her, bluntly and without softening, that Jack was not to be trusted. '.repeat(20)}Lira listened with her head tilted and asked, quite sincerely`
    const cut = cutAtSentence(long, 900)
    expect(cut.length).toBeLessThanOrEqual(900)
    expect(cut.endsWith('trusted.')).toBe(true)
    expect(cutAtSentence('Short.', 900)).toBe('Short.')
    // No sentence end to cut at: cut short, and said so.
    expect(cutAtSentence('a'.repeat(50), 20)).toBe(`${'a'.repeat(19)}…`)
    const written = parseHappeningReply(`{"account": ${JSON.stringify(long)}, "memories": {}}`, happening)
    expect(written?.account.endsWith('trusted.')).toBe(true)
  })

  it('is read back from JSON, each memory by her id, and cut to length', () => {
    const written = parseHappeningReply('Here: {"account": "They fought in the quad.", "memories": {"Faye": "You shouted.", "tink": "You wept."}}', happening)
    expect(written).toEqual({ account: 'They fought in the quad.', memories: { faye: 'You shouted.', tink: 'You wept.' } })
    expect(parseHappeningReply('nothing', happening)).toBeUndefined()
    expect(parseHappeningReply('{"account": ""}', happening)).toBeUndefined()
  })

  it('takes the place of the game plain words, memories included, and only once', () => {
    const state = fresh()
    const plain = { ...state, happenings: [happening], memories: { faye: [{ time: 30, summary: happeningMemory(content, state, happening, 'faye'), level: 'normal' as const }] } }
    const written = writeHappening(content, plain, happening.id, { account: 'They fought in the quad.', memories: { faye: 'You shouted at her.' } })
    expect(written.happenings[0].account).toBe('They fought in the quad.')
    expect(written.happenings[0].written).toBe(true)
    expect(written.memories.faye[0].summary).toBe('You shouted at her.')
    expect(writeHappening(content, written, happening.id, { account: 'Again', memories: {} })).toBe(written)
  })

  it('tells him what they are to each other once he has been told, and nothing more', () => {
    const state = { ...setRelation(fresh(), 'faye', 'tink', 'enemies'), happenings: [{ ...happening, tellerId: 'faye' }] }
    expect(knownRelation(state, 'faye', 'tink')).toBeUndefined()
    const heard = hearHappening(state, happening.id)
    expect(knownRelation(heard, 'faye', 'tink')).toBe('enemies')
    expect(heard.happenings[0].heard).toBe(true)
    expect(hearHappening(heard, happening.id)).toBe(heard)
    // Written, and told: nothing left for the background to do.
    expect(pendingHappenings(heard).map((one) => one.id)).toEqual([happening.id])
    expect(pendingHappenings({ ...heard, happenings: heard.happenings.map((one) => ({ ...one, written: true })) })).toEqual([])
  })
})
