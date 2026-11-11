import { kindOf, type ContentPack, type GameState, type NewsItem, type NewsPaper, type NewsPlan, type NewsSource } from '../model'
import { toDate } from './calendar'
import { roll } from './feed'
import { canonCovers, coveredBy } from './canon'
import { t } from '../i18n'

// One day in two has a story, unless something of his own is the story.
const NEWS_CHANCE = 0.5
// The draws of the day's roll that are the news's, apart from the feed's own: whether there is a story, which paper
// runs it, and whom the University's is about.
const NEWS_DRAW = 97
const PAPER_DRAW = 98
const FEATURE_DRAW = 99
// A story from the wider world is the kingdom's half the time, and the University's paper's the other half.
const NATIONAL_CHANCE = 0.5
// How many days of news a love interest has heard of, today's among them.
export const NEWS_DAYS_KNOWN = 3
// How many stories are kept: a season of them.
const NEWS_KEPT = 60
// The Queen, whose child by him is the kingdom's news.
const QUEEN = 'seraphine'

/** The love interests who have carried his child, or carry it now, by id. */
function mothersOf(content: ContentPack, state: GameState): string[] {
  const ids = new Set([...Object.keys(state.pregnancies), ...state.children.map((child) => child.motherId)])
  return content.loveInterests.filter((li) => ids.has(li.id)).map((li) => li.id)
}

/**
 * The things of his own that are news, as far as the game can tell from what it keeps: each its id (with when it
 * happened, where it can happen again), whether it has happened, and what happened, as the writer is told it.
 * In the order they are news: the Queen's first.
 */
export function milestones(content: ContentPack, state: GameState): { id: string; brief: string; paper: NewsPaper }[] {
  const player = state.player.name
  const found: { id: string; brief: string; paper: NewsPaper }[] = []
  const queen = content.loveInterests.find((li) => li.id === QUEEN)
  const carrying = queen && state.pregnancies[queen.id]
  if (queen && carrying) found.push({ id: `queen-with-child:${carrying.conceivedAt}`, paper: 'national', brief: t('llm.news.milestone.queenWithChild', { queen: queen.name, player }) })
  for (const child of state.children.filter((one) => one.motherId === QUEEN)) {
    found.push({ id: `royal-birth:${child.bornAt}`, paper: 'national', brief: t('llm.news.milestone.royalBirth', { queen: queen?.name ?? QUEEN, player, daughter: child.daughter, name: child.name }) })
  }
  const mothers = mothersOf(content, state).length
  const all = content.loveInterests.length
  if (all > 0 && mothers >= all) found.push({ id: 'mothers-all', paper: 'national', brief: t('llm.news.milestone.mothers', { player, count: mothers, all: true }) })
  for (const count of [10, 5]) if (mothers >= count && count < all) found.push({ id: `mothers-${count}`, paper: 'student', brief: t('llm.news.milestone.mothers', { player, count, all: false }) })
  if (state.children.length > 0) found.push({ id: 'first-child', paper: 'student', brief: t('llm.news.milestone.firstChild', { player }) })
  const depths = content.expedition?.depths.length ?? 0
  if (depths > 0 && state.expedition.cleared >= depths) found.push({ id: 'undercroft-cleared', paper: 'student', brief: t('llm.news.milestone.undercroft', { player }) })
  return found
}

/** Whether today's news is still to be decided: once a day, as soon as the day begins, however far the clock jumped. */
export function newsDue(content: ContentPack, state: GameState): boolean {
  return toDate(content.calendar, state.time).dayIndex > state.newsDay
}

/**
 * Decides the day's news. Something of his own that has happened and not yet been news is the story, one a day, the
 * Queen's first; otherwise one day in two has a story from the wider world. The first time a game decides its news,
 * what he had done already is taken as old news, so that a game from before there was news does not run it all now.
 * A plan not written by the next morning gives way to that day's; something of his own not yet told is told then, and
 * a canon story goes back to the head of the queue. What the canon has made news comes before all of it, one a day.
 */
export function newsRound(content: ContentPack, state: GameState): GameState {
  const day = toDate(content.calendar, state.time).dayIndex
  const queue = [...(state.newsPlan?.kind === 'canon' ? [state.newsPlan] : []), ...state.newsQueue]
  const known = milestones(content, state)
  const first = state.newsDay < 0 && state.newsReported.length === 0
  // A canon story going out tells of what it covers: that is news now, and a story still to come holds back what it will tell.
  const told = queue[0]?.covers ?? []
  const reported = [...new Set([...(first ? known.map((one) => one.id) : state.newsReported), ...known.map((one) => one.id).filter((id) => coveredBy(told, id))])]
  const held = canonCovers(content, state)
  const pending = known.find((one) => !reported.includes(one.id) && !coveredBy(held, one.id))
  const plan: NewsPlan | undefined = queue[0]
    ? { ...queue[0], day }
    : pending
      ? { day, kind: 'player', paper: pending.paper, trigger: pending.id, brief: pending.brief }
      : roll(state.weatherSeed, day, NEWS_DRAW) < NEWS_CHANCE
        ? worldStory(content, state, day)
        : undefined
  return { ...state, newsDay: day, newsReported: reported, newsPlan: plan, newsQueue: queue.slice(1) }
}

/**
 * A day's story from the wider world: the kingdom's half the time; otherwise the University paper's, about one of its
 * students or teachers, by the day's luck. Which is fixed by the game's seed, so the same day has the same story.
 */
function worldStory(content: ContentPack, state: GameState, day: number): NewsPlan {
  if (roll(state.weatherSeed, day, PAPER_DRAW) < NATIONAL_CHANCE) return { day, kind: 'world', paper: 'national' }
  const cast = content.loveInterests.filter((li) => ['student', 'teacher'].includes(kindOf(li)))
  const featuring = cast[Math.floor(roll(state.weatherSeed, day, FEATURE_DRAW) * cast.length)]
  return { day, kind: 'world', paper: 'student', ...(featuring && { featuring: featuring.id }) }
}

/** What the LLM wrote of the day's story, before it is filed. */
export interface WrittenNews {
  headline: string
  summary: string
  /** A picture to run with it, for an image model. */
  picture: string
}

/**
 * Files the day's story, written: only while it is still the one planned, so that one that comes back after the day
 * has moved on is let go. A story of his own is counted as told.
 */
export function fileNews(state: GameState, plan: NewsPlan, written: WrittenNews, source: NewsSource, image?: string): GameState {
  if (!state.newsPlan || state.newsPlan.day !== plan.day || state.newsPlan.trigger !== plan.trigger) return state
  const item: NewsItem = {
    id: `news-${plan.day}`,
    paper: plan.paper,
    ...(plan.featuring && { featuring: plan.featuring }),
    day: plan.day,
    time: state.time,
    headline: written.headline,
    summary: written.summary,
    ...(image && { image }),
    source,
    ...(plan.trigger && { trigger: plan.trigger })
  }
  return {
    ...state,
    news: [...state.news.filter((one) => one.id !== item.id), item].slice(-NEWS_KEPT),
    newsPlan: undefined,
    newsReported: plan.trigger && !state.newsReported.includes(plan.trigger) ? [...state.newsReported, plan.trigger] : state.newsReported
  }
}

/** The news a love interest has heard: the stories of the last few days, today's among them, newest first. */
export function recentNews(content: ContentPack, state: GameState, days = NEWS_DAYS_KNOWN): NewsItem[] {
  const today = toDate(content.calendar, state.time).dayIndex
  return state.news.filter((one) => one.time <= state.time && one.day > today - days).reverse()
}

/** The stories he has not read. */
export function unreadNews(state: Pick<GameState, 'news' | 'newsSeen' | 'time'>): number {
  return state.news.filter((one) => one.time > state.newsSeen && one.time <= state.time).length
}

export function markNewsSeen(state: GameState): GameState {
  return { ...state, newsSeen: state.time }
}

/**
 * The prompt for the day's story. `search` is set when the model can look up the day's real news, which it is told
 * the date of to re-tell as the Sown Expanse's; without it, a story of the world's own.
 */
export function buildNewsPrompt(content: ContentPack, state: GameState, plan: NewsPlan, search?: { date: string }): { system: string; user: string } {
  const date = toDate(content.calendar, state.time)
  const recent = state.news.slice(-5).map((one) => `- ${one.headline}`)
  const about = plan.featuring ? content.loveInterests.find((li) => li.id === plan.featuring) : undefined
  const system = [
    t(plan.paper === 'student' ? 'llm.news.systemStudent' : 'llm.news.system'),
    t('llm.news.world'),
    t('llm.news.reply', { format: '{"headline": string, "summary": string, "picture": string}' }),
    t('llm.news.rules')
  ].join('\n')
  const ask =
    plan.kind !== 'world' && plan.brief
      ? t(plan.kind === 'canon' ? 'llm.news.canon' : 'llm.news.player', { brief: plan.brief })
      : plan.paper === 'student'
        ? about
          ? t('llm.news.feature', { name: about.name, about: [about.bio, about.personality].filter(Boolean).join(' '), player: state.player.name })
          : t('llm.news.inventStudent', { player: state.player.name })
        : search
          ? t('llm.news.search', { date: search.date })
          : t('llm.news.invent', { player: state.player.name })
  const user = [
    t('llm.news.today', { weekday: date.weekday, day: date.day, month: date.month.name }),
    ask,
    ...(recent.length > 0 ? [t('llm.news.recent'), ...recent] : [])
  ].join('\n')
  return { system, user }
}

/** What a reply makes of the day's story: the JSON object in it, with a headline and a summary, cut to length. */
export function parseNewsReply(reply: string): WrittenNews | undefined {
  const found = /\{[\s\S]*\}/.exec(reply.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ''))
  if (!found) return undefined
  let read: Record<string, unknown>
  try {
    read = JSON.parse(found[0]) as Record<string, unknown>
  } catch {
    return undefined
  }
  const text = (value: unknown, most: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, most) : '')
  const headline = text(read.headline, 160)
  const summary = text(read.summary, 600)
  if (headline === '' || summary === '') return undefined
  return { headline, summary, picture: text(read.picture, 1000) }
}
