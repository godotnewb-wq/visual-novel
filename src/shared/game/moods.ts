import type { ContentPack, GameState, Happening } from '../model'
import { toDate } from './calendar'
import { t } from '../i18n'

/**
 * Her mood of the day: what the last thing that happened to her in the social web has left her feeling. It lasts the
 * day it happened and the next, colors every scene and DM of hers, and is told to the LLM alone: he feels the web
 * before anyone tells him anything. Nothing is kept for it; it is read off the happenings.
 */

export const MOODS = ['glad', 'hurt', 'angry', 'elated', 'guilty', 'wary', 'eager', 'relieved'] as const
export type MoodKind = (typeof MOODS)[number]

/** How many days a happening colors her, the day it happened counted. */
const MOOD_DAYS = 2

export interface Mood {
  mood: MoodKind
  /** What left her so. */
  happening: Happening
}

/** What a happening leaves one of the two feeling, by what it was and which of them she is. */
export function moodFrom(happening: Pick<Happening, 'kind' | 'ids' | 'tone' | 'overPlayer'>, id: string): MoodKind | undefined {
  const teller = happening.ids[0] === id
  switch (happening.kind) {
    case 'friendship':
    case 'outing':
      return 'glad'
    case 'peace':
      return 'relieved'
    case 'falling-out':
    case 'parting':
      return 'hurt'
    case 'feud':
    case 'alliance':
      return 'angry'
    case 'spark':
      return 'elated'
    case 'invitation':
      return 'eager'
    case 'gossip':
      if (happening.tone === 'betrayal') return teller ? 'guilty' : 'angry'
      if (happening.tone === 'warning') return teller ? undefined : 'wary'
      return teller ? undefined : 'glad'
  }
}

/** Her mood today, if the web has given her one: from the last thing that happened to her within the last two days. */
export function moodOf(content: ContentPack, state: Pick<GameState, 'happenings' | 'time'>, id: string): Mood | undefined {
  const today = toDate(content.calendar, state.time).dayIndex
  const recent = [...state.happenings].reverse().find((one) => one.ids.includes(id) && one.day > today - MOOD_DAYS && one.time <= state.time)
  if (!recent) return undefined
  const mood = moodFrom(recent, id)
  return mood && { mood, happening: recent }
}

/**
 * Told to whoever writes her: what she is feeling today and what left her so, in her own memory's words where she has
 * one of it. `self` for the one being written, else of a companion by her first name.
 */
export function describeMood(content: ContentPack, state: GameState, id: string, player: string, self = true): string | undefined {
  const found = moodOf(content, state, id)
  if (!found) return undefined
  const remembered = (state.memories[id] ?? []).find((memory) => memory.time === found.happening.time)?.summary ?? found.happening.account
  const first = content.loveInterests.find((li) => li.id === id)?.name.split(' ')[0] ?? id
  return t('scene.prompt.mood', { self, name: first, mood: found.mood, player, about: remembered, overHim: found.happening.overPlayer })
}
