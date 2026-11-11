import type { CanonCase, CanonChange, CanonStep, ContentPack, GameState, LoveInterest, NewsPlan } from '../model'
import { toDate } from './calendar'
import { applyEffects, evaluateAll } from './conditions'
import { addMemory } from './memory'

/**
 * Canon events: the world's own story, happening on its own days and going the way his game has gone. Each morning the
 * steps that are due happen, each once, by the first of their cases that holds; what they make news waits its turn in
 * the news's queue, and what they change of a love interest is kept in the save and put into the content by `withCanon`.
 */

/** Whether today's canon is still to be looked at: once a day, as soon as the day begins. */
export function canonDue(content: ContentPack, state: GameState): boolean {
  return content.canon.events.length > 0 && toDate(content.calendar, state.time).dayIndex > state.canonDay
}

/** Whether a step that has not happened is due by `day` (`dayIndex`): its day reached, or its days after the step it follows. */
function isDue(step: CanonStep, fired: GameState['canonFired'], day: number): boolean {
  if (step.day !== undefined) return day + 1 >= step.day
  if (!step.after) return false
  const before = fired[step.after.step]
  return before !== undefined && (step.after.case === undefined || before.case === step.after.case) && day >= before.day + step.after.days
}

/**
 * The day's canon: every step due and not yet happened happens, in the order the content has them, and a step that
 * follows one that happened today on the same day happens after it. A step whose day passed while the game was not
 * played happens now, once. Steps are known by id across events, so that a translation or an add-on can find them.
 */
export function canonRound(content: ContentPack, state: GameState): GameState {
  const day = toDate(content.calendar, state.time).dayIndex
  let next: GameState = { ...state, canonDay: day }
  for (let more = true; more; ) {
    more = false
    for (const event of content.canon.events) {
      for (const step of event.steps) {
        if (next.canonFired[step.id] || !isDue(step, next.canonFired, day)) continue
        const taken = step.cases.find((one) => evaluateAll(one.when, { content, state: next }))
        // A step none of whose cases holds waits, and is looked at again the next morning.
        if (!taken) continue
        next = happen(content, { ...next, canonFired: { ...next.canonFired, [step.id]: { case: taken.id, day } } }, taken, day, event.name)
        more = true
      }
    }
  }
  return next
}

/** What a case does as it happens: its effects, memories and changes, and its story put in the news's queue. */
function happen(content: ContentPack, state: GameState, taken: CanonCase, day: number, source: string): GameState {
  let next = applyEffects(state, taken.effects, { content, source })
  for (const memory of taken.memories) next = addMemory(next, memory.loveInterestId, memory.summary, memory.level)
  if (taken.changes.length > 0) {
    const changes = { ...next.canonChanges }
    for (const change of taken.changes) changes[change.loveInterestId] = merged(changes[change.loveInterestId], change)
    next = { ...next, canonChanges: changes }
  }
  if (taken.news) {
    const { paper, featuring, brief, covers } = taken.news
    const plan: NewsPlan = { day, kind: 'canon', paper, brief, ...(featuring && { featuring }), ...(covers.length > 0 && { covers }) }
    next = { ...next, newsQueue: [...next.newsQueue, plan] }
  }
  return next
}

/**
 * The milestones of his that a canon story still to come may tell (as `covers` names them): held back from being news
 * of their own until it has, so that the Queen's child is not news the week before the decree that tells of it. A step
 * still to come is one that has not happened and can: dated, or following a step still to come, or one that went the
 * way it waits on.
 */
export function canonCovers(content: ContentPack, state: Pick<GameState, 'canonFired'>): string[] {
  const fired = state.canonFired
  const covers = new Set<string>()
  for (const event of content.canon.events) {
    const toCome = (step: CanonStep, seen: Set<string>): boolean => {
      if (fired[step.id] || seen.has(step.id)) return false
      if (!step.after) return true
      const before = fired[step.after.step]
      if (before) return step.after.case === undefined || before.case === step.after.case
      const earlier = event.steps.find((one) => one.id === step.after!.step)
      return earlier !== undefined && toCome(earlier, new Set([...seen, step.id]))
    }
    for (const step of event.steps) if (toCome(step, new Set())) for (const taken of step.cases) for (const id of taken.news?.covers ?? []) covers.add(id)
  }
  return [...covers]
}

/** Whether a milestone (`queen-with-child:120`) is one a `covers` list names (`queen-with-child`). */
export function coveredBy(covers: string[], id: string): boolean {
  return covers.some((prefix) => id === prefix || id.startsWith(`${prefix}:`))
}

/** A later change over an earlier one: what it says in place of what that said, and what it adds to her story after it. */
function merged(before: CanonChange | undefined, change: CanonChange): CanonChange {
  if (!before) return change
  const after = (a?: string, b?: string) => (a && b ? `${a}\n\n${b}` : (b ?? a))
  return { ...before, ...change, backstory: after(before.backstory, change.backstory), extraInstructions: after(before.extraInstructions, change.extraInstructions) }
}

// The content for each set of changes it has been asked for with, so that the same game gets the same pack back.
const made = new WeakMap<ContentPack, Map<string, ContentPack>>()

/** The content as this game's canon has changed it: love interests as the events have left them. */
export function withCanon(content: ContentPack, state: Pick<GameState, 'canonChanges'>): ContentPack {
  const changes = state.canonChanges
  if (Object.keys(changes).length === 0) return content
  const key = JSON.stringify(Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)))
  let byKey = made.get(content)
  if (!byKey) made.set(content, (byKey = new Map()))
  let pack = byKey.get(key)
  if (!pack) byKey.set(key, (pack = { ...content, loveInterests: content.loveInterests.map((li) => (changes[li.id] ? changed(li, changes[li.id]) : li)) }))
  return pack
}

function changed(li: LoveInterest, change: CanonChange): LoveInterest {
  const after = (a: string, b?: string) => (b ? (a ? `${a}\n\n${b}` : b) : a)
  return {
    ...li,
    role: change.role ?? li.role,
    bio: change.bio ?? li.bio,
    personality: change.personality ?? li.personality,
    schedule: change.schedule ?? li.schedule,
    room: change.room ?? li.room,
    ai: { ...li.ai, backstory: after(li.ai.backstory, change.backstory), extraInstructions: after(li.ai.extraInstructions, change.extraInstructions) }
  }
}
