import { z } from 'zod'

/** Where a story came from: something of the player's own, a real one re-told in the Sown Expanse, or one made up. */
export const NEWS_SOURCES = ['player', 'world', 'invented'] as const
export type NewsSource = (typeof NEWS_SOURCES)[number]

/** Which paper runs a story: the kingdom's, or the University's own, where the cast are news. */
export const NEWS_PAPERS = ['national', 'student'] as const
export type NewsPaper = (typeof NEWS_PAPERS)[number]

/** One story of the day's news, as the News app shows it and love interests have heard it. */
export const NewsItemSchema = z.object({
  id: z.string(),
  /** Stories from before there were two papers were all the kingdom's. */
  paper: z.enum(NEWS_PAPERS).default('national'),
  /** The love interest a student paper's story is about, by id. */
  featuring: z.string().optional(),
  /** The day it ran (`toDate(...).dayIndex`), and the game time it went up. */
  day: z.number().int().min(0),
  time: z.number().int().min(0),
  headline: z.string().max(160),
  summary: z.string().max(600),
  /** Its picture, relative to the pack, when ComfyUI drew one. */
  image: z.string().optional(),
  source: z.enum(NEWS_SOURCES),
  /** The milestone of his it tells of, for a story of the player's own. */
  trigger: z.string().optional()
})
export type NewsItem = z.infer<typeof NewsItemSchema>

/**
 * The day's story, decided in the morning and written when the LLM can: what kind it is, and for one of the player's
 * own, the milestone and what happened, as the writer is told it.
 */
export const NewsPlanSchema = z.object({
  day: z.number().int().min(0),
  kind: z.enum(['player', 'world', 'canon']),
  paper: z.enum(NEWS_PAPERS).default('national'),
  /** For the student paper: the love interest the story is about, by id. */
  featuring: z.string().optional(),
  trigger: z.string().optional(),
  brief: z.string().optional(),
  /** For a canon story: the milestones of his it tells of, made old news once it runs. */
  covers: z.array(z.string()).optional()
})
export type NewsPlan = z.infer<typeof NewsPlanSchema>
