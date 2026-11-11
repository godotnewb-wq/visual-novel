import { describe, expect, it } from 'vitest'
import type { ContentPack, GameState } from '../model'
import { buildNewsPrompt, fileNews, markNewsSeen, newsDue, newsRound, parseNewsReply, recentNews, unreadNews } from './news'
import { createInitialState } from './state'
import { fixture } from './testFixture'

// Fixture calendar: a 20-hour day, the game starting at 06:00, so each day begins 20 hours after the last.
const base = fixture()
const ana = base.loveInterests[0]
// Seraphine, the Queen, beside Ana: her child is the kingdom's news.
const content: ContentPack = { ...base, loveInterests: [{ ...ana, kind: 'student' as const, bio: 'Builds clockwork songbirds.' }, { ...ana, id: 'seraphine', name: 'Seraphine V', kind: 'outsider' as const }] }
const dayAt = (day: number, hour = 8) => day * 20 + hour - 6
const start = (): GameState => ({ ...createInitialState(content), time: dayAt(0) })
const written = { headline: 'Assembly clashes with the Queen', summary: 'A vote in the Assembly went against the Crown.', picture: 'the Assembly hall at dusk' }

/** The day's round with the roll forced one way: a seed whose day has news, or has none. */
function seedWith(news: boolean, day = 0): number {
  for (let seed = 1; seed < 1000; seed++) {
    const state = { ...start(), weatherSeed: seed, time: dayAt(day) }
    if ((newsRound(content, state).newsPlan !== undefined) === news) return seed
  }
  throw new Error('no such seed')
}

describe('the day\'s news', () => {
  it('is decided once a day, however far the clock has jumped', () => {
    const state = start()
    expect(newsDue(content, state)).toBe(true)
    const decided = newsRound(content, state)
    expect(decided.newsDay).toBe(0)
    expect(newsDue(content, { ...decided, time: dayAt(0, 18) })).toBe(false)
    expect(newsDue(content, { ...decided, time: dayAt(5) })).toBe(true)
  })

  it('has a story from the wider world on about one day in two, by the game\'s own luck', () => {
    const days = Array.from({ length: 200 }, (_, day) => newsRound(content, { ...start(), weatherSeed: 42, newsDay: day - 1, newsReported: ['x'], time: dayAt(day) }).newsPlan)
    const some = days.filter((plan) => plan !== undefined).length
    expect(some).toBeGreaterThan(70)
    expect(some).toBeLessThan(130)
    expect(days.every((plan) => plan === undefined || plan.kind === 'world')).toBe(true)
    // The same game, the same day: the same answer.
    expect(newsRound(content, { ...start(), weatherSeed: 42 }).newsPlan).toEqual(newsRound(content, { ...start(), weatherSeed: 42 }).newsPlan)
  })

  it('makes the Queen with his child the story, once, before anything else of his, on a day with no luck', () => {
    const quiet = seedWith(false, 1)
    // A game already going: what he had done before there was news is old news.
    const before = newsRound(content, { ...start(), weatherSeed: quiet, children: [{ motherId: 'ana', bornAt: 0, daughter: true, name: 'Rosa', thrivingWeeks: 0 }] })
    expect(before.newsReported).toContain('first-child')
    const carrying = { ...before, time: dayAt(1), pregnancies: { seraphine: { conceivedAt: 10, dueAt: 90 }, ana: { conceivedAt: 12, dueAt: 92 } } }
    const decided = newsRound(content, carrying)
    expect(decided.newsPlan).toMatchObject({ day: 1, kind: 'player', trigger: 'queen-with-child:10' })
    expect(decided.newsPlan?.brief).toContain('Seraphine V')
    const told = fileNews(decided, decided.newsPlan!, written, 'player')
    expect(told.newsReported).toContain('queen-with-child:10')
    // Told, it is not told again: the next day has every woman of his (both of them) as its story.
    const next = newsRound(content, { ...told, time: dayAt(2) })
    expect(next.newsPlan).toMatchObject({ kind: 'player', trigger: 'mothers-all' })
  })

  it('files the story only while it is still the day\'s, and keeps a season of them', () => {
    const decided = newsRound(content, { ...start(), weatherSeed: seedWith(true) })
    const plan = decided.newsPlan!
    const filed = fileNews(decided, plan, written, 'invented', 'news/pic.png')
    expect(filed.news).toEqual([{ id: 'news-0', paper: plan.paper, ...(plan.featuring && { featuring: plan.featuring }), day: 0, time: dayAt(0), headline: written.headline, summary: written.summary, image: 'news/pic.png', source: 'invented' }])
    expect(filed.newsPlan).toBeUndefined()
    // Come back after the day has moved on, it is let go.
    expect(fileNews({ ...decided, newsPlan: { day: 3, kind: 'world', paper: 'national' } }, plan, written, 'world')).toEqual({ ...decided, newsPlan: { day: 3, kind: 'world', paper: 'national' } })
    const many = Array.from({ length: 70 }, (_, day) => ({ id: `news-${day}`, paper: 'national' as const, day, time: day, headline: 'h', summary: 's', source: 'world' as const }))
    expect(fileNews({ ...decided, news: many }, plan, written, 'world').news).toHaveLength(60)
  })

  it('is heard of for three days, and counts as unread until he looks', () => {
    const story = (day: number) => ({ id: `news-${day}`, paper: 'national' as const, day, time: dayAt(day), headline: `day ${day}`, summary: 's', source: 'world' as const })
    const state = { ...start(), time: dayAt(5, 12), news: [3, 4, 5, 6].map(story).filter((one) => one.day <= 5).concat(story(1)) }
    expect(recentNews(content, state).map((one) => one.day)).toEqual([5, 4, 3])
    expect(unreadNews(state)).toBe(4)
    expect(unreadNews(markNewsSeen(state))).toBe(0)
  })
})

describe('the two papers', () => {
  it('give a story from the wider world to the kingdom\'s paper half the time, and the rest to the University\'s, about one of its own', () => {
    const plans = Array.from({ length: 300 }, (_, day) => newsRound(content, { ...start(), weatherSeed: 7, newsDay: day - 1, newsReported: ['x'], time: dayAt(day) }).newsPlan).filter((plan) => plan !== undefined)
    const student = plans.filter((plan) => plan!.paper === 'student')
    expect(student.length).toBeGreaterThan(plans.length * 0.35)
    expect(student.length).toBeLessThan(plans.length * 0.65)
    // The University's is about a student or a teacher: Ana, never the Queen; the kingdom's is about nobody in particular.
    expect(student.every((plan) => plan!.featuring === 'ana')).toBe(true)
    expect(plans.filter((plan) => plan!.paper === 'national').every((plan) => plan!.featuring === undefined)).toBe(true)
  })

  it('put each thing of his in the paper that would run it: the Queen\'s in the kingdom\'s, his first child in the University\'s', () => {
    const quiet = { ...start(), weatherSeed: seedWith(false, 1), newsDay: 0, newsReported: ['x'], time: dayAt(1) }
    expect(newsRound(content, { ...quiet, pregnancies: { seraphine: { conceivedAt: 3, dueAt: 90 } } }).newsPlan).toMatchObject({ paper: 'national', trigger: 'queen-with-child:3' })
    expect(newsRound(content, { ...quiet, children: [{ motherId: 'ana', bornAt: 4, daughter: false, name: 'Tom', thrivingWeeks: 0 }] }).newsPlan).toMatchObject({ paper: 'student', trigger: 'first-child' })
  })

  it('tell the University\'s writer who the story is about, and never send it to the web', () => {
    const plan = { day: 0, kind: 'world' as const, paper: 'student' as const, featuring: 'ana' }
    const asked = buildNewsPrompt(content, start(), plan, { date: '2026-11-09' })
    expect(asked.system).toContain('The Cloister Courier')
    expect(asked.user).toContain('Today\'s story is about Ana: Builds clockwork songbirds.')
    expect(asked.user).not.toContain('Search the web')
  })
})

describe('writing the news', () => {
  it('asks for the day\'s real story only where the model can search, and a story of the world\'s own otherwise', () => {
    const plan = { day: 0, kind: 'world' as const, paper: 'national' as const }
    expect(buildNewsPrompt(content, start(), plan, { date: '2026-11-09' }).user).toContain('Search the web for the most important news story of 2026-11-09')
    expect(buildNewsPrompt(content, start(), plan).user).toContain('Make up today\'s story')
    expect(buildNewsPrompt(content, start(), { ...plan, kind: 'player', brief: 'The Queen is with child.' }).user).toContain('The Queen is with child.')
    expect(buildNewsPrompt(content, start(), plan).system).toContain('no real-world name')
  })

  it('reads the story out of the reply, and nothing out of a reply with none', () => {
    expect(parseNewsReply(`Here it is:\n${JSON.stringify(written)}`)).toEqual(written)
    expect(parseNewsReply('{"headline": "  Only   a headline "}')).toBeUndefined()
    expect(parseNewsReply('no json at all')).toBeUndefined()
    expect(parseNewsReply(JSON.stringify({ ...written, headline: 'x'.repeat(400) }))?.headline).toHaveLength(160)
  })
})
