import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadContentPack } from '../../main/content/loader'
import type { Happening } from '../model'
import { chanceOfDm, giveContact } from './courier'
import { describeMood, moodFrom, moodOf } from './moods'
import { buildCharacterPrompt } from './prompt'
import { createInitialState } from './state'

const content = loadContentPack(join(process.cwd(), 'content', 'default'))
const day = content.calendar.hoursPerDay
const happening = (patch: Partial<Happening>): Happening => ({ id: 'h', kind: 'feud', day: 1, time: day + 10, ids: ['faye', 'tink'], overPlayer: false, account: 'Faye and Tink quarreled.', written: false, heard: false, ...patch })

describe('her mood of the day', () => {
  it('follows from what happened and which of the two she is', () => {
    expect(moodFrom(happening({ kind: 'spark' }), 'faye')).toBe('elated')
    expect(moodFrom(happening({ kind: 'parting' }), 'tink')).toBe('hurt')
    expect(moodFrom(happening({ kind: 'alliance' }), 'tink')).toBe('angry')
    // Gossip: the one told feels it; the teller only when she has something to feel guilty about.
    expect(moodFrom(happening({ kind: 'gossip', tone: 'praise' }), 'faye')).toBeUndefined()
    expect(moodFrom(happening({ kind: 'gossip', tone: 'praise' }), 'tink')).toBe('glad')
    expect(moodFrom(happening({ kind: 'gossip', tone: 'warning' }), 'tink')).toBe('wary')
    expect(moodFrom(happening({ kind: 'gossip', tone: 'betrayal' }), 'faye')).toBe('guilty')
    expect(moodFrom(happening({ kind: 'gossip', tone: 'betrayal' }), 'tink')).toBe('angry')
  })

  it('lasts the day it happened and the next, and is the latest thing', () => {
    const start = createInitialState(content, 'Pat', 1)
    const state = { ...start, time: day + 12, happenings: [happening({ kind: 'friendship', day: 0, time: 10, id: 'a' }), happening({ id: 'b' })] }
    expect(moodOf(content, state, 'faye')?.mood).toBe('angry')
    expect(moodOf(content, state, 'anwen')).toBeUndefined()
    expect(moodOf(content, { ...state, time: 2 * day + 12 }, 'tink')?.mood).toBe('angry')
    expect(moodOf(content, { ...state, time: 3 * day + 12 }, 'tink')).toBeUndefined()
    // Not before it has happened.
    expect(moodOf(content, { ...state, time: day + 9 }, 'faye')?.mood).toBe('glad')
  })

  it('is told to whoever writes her, in her own memory of it, and to a group of a companion too', () => {
    const start = createInitialState(content, 'Pat', 1)
    const state = { ...start, time: day + 12, happenings: [happening({ overPlayer: true })], memories: { faye: [{ time: day + 10, summary: 'You and Tink quarreled over Pat, bitterly.', level: 'normal' as const }] } }
    expect(describeMood(content, state, 'faye', 'Pat')).toContain('You are angry today')
    expect(describeMood(content, state, 'faye', 'Pat')).toContain('You and Tink quarreled over Pat, bitterly.')
    expect(describeMood(content, state, 'tink', 'Pat', false)).toContain('Tink is angry today')
    expect(describeMood(content, state, 'tink', 'Pat', false)).toContain('Faye and Tink quarreled.')
    expect(describeMood(content, state, 'anwen', 'Pat')).toBeUndefined()
    const solo = buildCharacterPrompt({ content, state, loveInterestId: 'faye', sceneBeats: [{ activityName: 'Tea' }] })
    expect(solo).toContain('## Today')
    expect(solo).toContain('You are angry today')
    const group = buildCharacterPrompt({ content, state, loveInterestId: 'anwen', companionIds: ['tink'], sceneBeats: [{ activityName: 'Tea' }] })
    expect(group).toContain('Tink is angry today')
    expect(group).not.toContain('## Today')
  })

  it('makes her likelier to write to him', () => {
    const start = giveContact(createInitialState(content, 'Pat', 1), 'faye')
    const calm = { ...start, time: day + 12, relationships: { ...start.relationships, faye: { affection: 30, trust: 30, desire: 10 } } }
    const moody = { ...calm, happenings: [happening({})] }
    expect(chanceOfDm(content, moody, 'faye')).toBeCloseTo(chanceOfDm(content, calm, 'faye') + 0.1)
  })
})
