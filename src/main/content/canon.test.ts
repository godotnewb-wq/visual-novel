import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GameState } from '../../shared/model'
import { canonRound, createInitialState, newsRound, toDate, withCanon } from '../../shared/game'
import { loadContentPack } from './loader'

/** The Queen's thread as the game ships it: the decree on day 45, and the two ways it can end fourteen days on. */
describe('the canon of the default pack', () => {
  const content = loadContentPack(join(process.cwd(), 'content', 'default'))
  const hours = content.calendar.hoursPerDay
  const start = createInitialState(content)
  // The morning of a day of the game, counting from 1.
  const on = (state: GameState, day: number): GameState => ({ ...state, time: start.time + (day - 1) * hours })
  const carrying = { seraphine: { conceivedAt: start.time, dueAt: start.time + 200 * hours } }

  it('puts the decree after the Masquerade', () => {
    const masquerade = content.calendar.events.find((event) => event.id === 'masquerade')!
    const decree = content.canon.events.flatMap((event) => event.steps).find((step) => step.id === 'queen-decree')!
    const masqueradeDay = toDate(content.calendar, start.time).dayIndex + content.calendar.months.slice(content.calendar.months.findIndex((m) => m.id === content.calendar.start.month), content.calendar.months.findIndex((m) => m.id === masquerade.month)).reduce((sum, m) => sum + m.days, 0) - content.calendar.start.day + masquerade.day + 1
    expect(decree.day).toBeGreaterThan(masqueradeDay)
  })

  it('tells of the heir she already carries, and names him the next day', () => {
    const decreed = canonRound(content, on({ ...start, pregnancies: carrying }, 45))
    expect(decreed.canonFired['queen-decree']?.case).toBe('heir')
    const named = canonRound(content, on(decreed, 46))
    expect(named.canonFired['queen-named']?.case).toBe('named')
    // With the steps before them that a game first played on day 45 has missed, which happen late.
    expect(named.newsQueue.filter((plan) => plan.brief?.includes('Seraphine V'))).toHaveLength(2)
  })

  it('gives him fourteen days, and without an heir by him the Council brokers one with Joven Stormbreaker', () => {
    const decreed = canonRound(content, on(start, 45))
    expect(decreed.canonFired['queen-decree']?.case).toBe('ultimatum')
    expect(canonRound(content, on(decreed, 58)).canonFired['queen-deadline']).toBeUndefined()
    const ended = canonRound(content, on(decreed, 59))
    expect(ended.canonFired['queen-deadline']?.case).toBe('brokered')
    expect(ended.flags['seraphine-brokered']).toBe(true)
    expect(ended.memories.seraphine?.every((memory) => memory.level === 'core')).toBe(true)
    expect(ended.newsQueue.at(-1)?.brief).toContain('Diplomatic seeding for Seraphine V brokered with Joven Stormbreaker of the Starkelands')
    // Still the Queen, where she was, and she knows what has been agreed.
    const her = withCanon(content, ended).loveInterests.find((li) => li.id === 'seraphine')!
    const before = content.loveInterests.find((li) => li.id === 'seraphine')!
    expect(her.room).toEqual(before.room)
    expect(her.schedule).toEqual(before.schedule)
    expect(her.ai.backstory).toContain('Joven Stormbreaker')
  })

  it('cancels the treaty the first morning she carries his child after it, and tells it in place of the usual story', () => {
    const brokered = canonRound(content, on(canonRound(content, on(start, 45)), 59))
    // Not with child: it waits, morning after morning.
    const waiting = canonRound(content, on(brokered, 70))
    expect(waiting.canonFired['treaty-cancelled']).toBeUndefined()
    // With child, the Queen's news of it is held for the treaty's story, not told on its own.
    const conceived = { ...waiting, newsQueue: [], newsDay: 70, newsReported: ['x'], pregnancies: { seraphine: { conceivedAt: on(waiting, 71).time, dueAt: on(waiting, 250).time } } }
    const held = newsRound(content, on(conceived, 71))
    expect(held.newsPlan?.trigger?.startsWith('queen-with-child')).not.toBe(true)
    const cancelled = canonRound(content, on(conceived, 72))
    expect(cancelled.canonFired['treaty-cancelled']).toEqual({ case: 'cancelled', day: toDate(content.calendar, on(conceived, 72).time).dayIndex })
    expect(cancelled.flags['seraphine-treaty-cancelled']).toBe(true)
    const told = newsRound(content, cancelled)
    expect(told.newsPlan?.brief).toContain('mysterious True Sire')
    expect(told.newsReported.some((id) => id.startsWith('queen-with-child'))).toBe(true)
    // The treaty is behind her, after what she was told of it.
    const her = withCanon(content, cancelled).loveInterests.find((li) => li.id === 'seraphine')!
    expect(her.ai.backstory.indexOf('That is behind her now')).toBeGreaterThan(her.ai.backstory.indexOf('Joven Stormbreaker'))
  })

  it('keeps the deadline open: an heir by then keeps her crown', () => {
    const decreed = canonRound(content, on(start, 45))
    const met = canonRound(content, on({ ...decreed, pregnancies: carrying }, 59))
    expect(met.canonFired['queen-deadline']?.case).toBe('met')
    expect(canonRound(content, on(met, 60)).canonFired['queen-named-late']?.case).toBe('named')
  })
})
