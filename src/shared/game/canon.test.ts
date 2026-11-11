import { describe, expect, it } from 'vitest'
import { CanonSchema, validateContentPack, type ContentPack, type GameState } from '../model'
import { canonDue, canonRound, withCanon } from './canon'
import { fileNews, newsRound } from './news'
import { createInitialState } from './state'
import { fixture, rawFixture } from './testFixture'

// Fixture calendar: a 20-hour day, the game starting at 06:00, so each day begins 20 hours after the last. Day 1 of the
// game, as canon steps count it, is `dayIndex` 0.
const base = fixture()
const ana = base.loveInterests[0]
const dayAt = (day: number, hour = 8) => day * 20 + hour - 6

// A decree on day 3: met at once if she is with child; otherwise a deadline two days on, met or not.
const canon = CanonSchema.parse({
  events: [
    {
      id: 'decree',
      name: 'The decree',
      steps: [
        {
          id: 'decree',
          day: 3,
          cases: [
            { id: 'heir', when: [{ type: 'pregnant', loveInterestId: 'ana', value: true }], news: { brief: 'Ana carries an heir.', covers: ['queen-with-child'] }, effects: [{ type: 'flag', flag: 'heir', value: true }] },
            { id: 'ultimatum', news: { brief: 'Ana must conceive.' }, memories: [{ loveInterestId: 'ana', summary: 'The council gave me two days.' }] }
          ]
        },
        {
          id: 'deadline',
          after: { step: 'decree', case: 'ultimatum', days: 2 },
          cases: [
            { id: 'met', when: [{ type: 'pregnant', loveInterestId: 'ana', value: true }], news: { brief: 'Ana carries an heir after all.' } },
            {
              id: 'abdicates',
              news: { brief: 'Ana gives up the throne.' },
              effects: [{ type: 'flag', flag: 'abdicated', value: true }],
              memories: [{ loveInterestId: 'ana', summary: 'I gave up the crown.', level: 'core' }],
              changes: [{ loveInterestId: 'ana', role: 'a commoner', bio: 'Once a queen.', backstory: 'She gave up the throne.', schedule: [{ locationId: 'shop' }] }]
            }
          ]
        }
      ]
    }
  ]
})
const content: ContentPack = { ...base, loveInterests: [{ ...ana, id: 'seraphine', name: 'Seraphine V' }, ana], canon }
const start = (): GameState => ({ ...createInitialState(content), time: dayAt(0) })
// Each morning in turn from the first, as the game goes through them.
function mornings(state: GameState, upTo: number, change: (state: GameState, day: number) => GameState = (s) => s): GameState {
  let next = state
  for (let day = 0; day <= upTo; day++) next = canonRound(content, change({ ...next, time: dayAt(day) }, day))
  return next
}

describe('canon events', () => {
  it('look at each day once, and a dated step happens on its day, not before', () => {
    expect(canonDue(content, start())).toBe(true)
    const early = mornings(start(), 1)
    expect(early.canonFired).toEqual({})
    expect(canonDue(content, { ...early, time: dayAt(1, 18) })).toBe(false)
    const due = mornings(start(), 2)
    expect(due.canonFired.decree).toEqual({ case: 'ultimatum', day: 2 })
    // Happened, it does not happen again.
    expect(canonRound(content, { ...due, time: dayAt(3) }).memories.ana).toHaveLength(1)
  })

  it('go by the first case that holds', () => {
    const carrying = mornings(start(), 2, (s) => ({ ...s, pregnancies: { ana: { conceivedAt: 1, dueAt: 90 } } }))
    expect(carrying.canonFired.decree?.case).toBe('heir')
    expect(carrying.flags.heir).toBe(true)
    // The deadline follows only the ultimatum.
    expect(mornings(carrying, 8).canonFired.deadline).toBeUndefined()
  })

  it('wait the days after the step they follow, and change her for the rest of the game', () => {
    const before = mornings(start(), 3)
    expect(before.canonFired.deadline).toBeUndefined()
    const after = mornings(start(), 4)
    expect(after.canonFired.deadline).toEqual({ case: 'abdicates', day: 4 })
    expect(after.flags.abdicated).toBe(true)
    expect(after.memories.ana?.map((m) => [m.summary, m.level])).toEqual([['The council gave me two days.', 'core'], ['I gave up the crown.', 'core']])
    const changed = withCanon(content, after).loveInterests.find((li) => li.id === 'ana')!
    expect(changed).toMatchObject({ role: 'a commoner', bio: 'Once a queen.', schedule: [{ locationId: 'shop' }] })
    expect(changed.ai.backstory.endsWith('She gave up the throne.')).toBe(true)
    // The same changes, the same pack; none, the content as it is.
    expect(withCanon(content, after)).toBe(withCanon(content, { canonChanges: { ...after.canonChanges } }))
    expect(withCanon(content, start())).toBe(content)
  })

  it('met before the deadline, go the other way', () => {
    const met = mornings(start(), 4, (s, day) => (day === 3 ? { ...s, pregnancies: { ana: { conceivedAt: dayAt(3), dueAt: 90 } } } : s))
    expect(met.canonFired.deadline?.case).toBe('met')
    expect(met.canonChanges).toEqual({})
  })

  it('happen late, once, in a game that missed their days, and what follows counts from then', () => {
    const late = canonRound(content, { ...start(), time: dayAt(9) })
    expect(late.canonFired).toEqual({ decree: { case: 'ultimatum', day: 9 } })
    // The deadline is his two days from when the decree was made, not from the day it was meant for.
    const after = canonRound(content, { ...late, time: dayAt(11) })
    expect(after.canonFired.deadline).toEqual({ case: 'abdicates', day: 11 })
    expect(after.newsQueue.map((plan) => plan.brief)).toEqual(['Ana must conceive.', 'Ana gives up the throne.'])
  })

  it('run as the news one a day, before anything else, and what they tell of is not told again', () => {
    const carrying = { ...start(), newsReported: ['x'], pregnancies: { seraphine: { conceivedAt: 1, dueAt: 90 }, ana: { conceivedAt: 1, dueAt: 90 } } }
    // Before the decree, the Queen's child is held back for it: not news of its own.
    const waiting = newsRound(content, { ...carrying, newsDay: 0, time: dayAt(1) })
    expect(waiting.newsPlan?.trigger).not.toBe('queen-with-child:1')
    expect(waiting.newsReported).not.toContain('queen-with-child:1')
    const fired = mornings(carrying, 2)
    const today = newsRound(content, fired)
    expect(today.newsPlan).toMatchObject({ kind: 'canon', day: 2, brief: 'Ana carries an heir.' })
    expect(today.newsReported).toContain('queen-with-child:1')
    expect(today.newsQueue).toEqual([])
    const told = fileNews(today, today.newsPlan!, { headline: 'An heir', summary: 'Ana carries one.', picture: '' }, 'player')
    expect(told.news.at(-1)?.headline).toBe('An heir')
    // Not written by the next morning, it goes back to the head of the queue.
    const unwritten = newsRound(content, { ...today, time: dayAt(3), newsQueue: [{ day: 3, kind: 'canon', paper: 'national', brief: 'Later.' }] })
    expect(unwritten.newsPlan?.brief).toBe('Ana carries an heir.')
    expect(unwritten.newsQueue.map((plan) => plan.brief)).toEqual(['Later.'])
  })

  it('name steps, cases and characters that exist', () => {
    const raw = rawFixture()
    const bad = { ...raw, canon: { events: [{ id: 'e', name: 'E', steps: [{ id: 's', after: { step: 'nowhere', days: 1 }, cases: [{ id: 'c', memories: [{ loveInterestId: 'nobody', summary: 'x' }] }] }] }] } }
    expect(() => validateContentPack(bad)).toThrow(/nowhere[\s\S]*nobody|nobody[\s\S]*nowhere/)
    expect(() => validateContentPack({ ...raw, canon })).not.toThrow()
  })
})
