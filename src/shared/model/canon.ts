import { z } from 'zod'
import { ConditionSchema, EffectSchema } from './condition'
import { RoomSchema, ScheduleEntrySchema } from './loveInterest'
import { NEWS_PAPERS } from './news'

/**
 * Canon events: the world's own story, on its own days. An event is a run of steps; each step happens on a day of the
 * game, or some days after another step went a given way, and goes the way of the first of its cases whose conditions
 * hold. A case can run as the day's news, set flags and the rest (`effects`), give love interests memories, and change
 * one of them for the rest of the game. `{player}` in any of it is the player's name.
 */

/** What a case changes of a love interest for the rest of the game: her standing, how she is told of, where she goes. */
export const CanonChangeSchema = z.object({
  loveInterestId: z.string(),
  role: z.string().optional(),
  bio: z.string().optional(),
  personality: z.string().optional(),
  /** Added to her backstory and to how she is to be played, after what is there. */
  backstory: z.string().optional(),
  extraInstructions: z.string().optional(),
  /** In place of her schedule. */
  schedule: z.array(ScheduleEntrySchema).optional(),
  /** In place of her room: where she lives now. */
  room: RoomSchema.optional()
})
export type CanonChange = z.infer<typeof CanonChangeSchema>

export const CanonCaseSchema = z.object({
  id: z.string(),
  /** All must hold for this case to be the one taken. Empty: it is the one taken when none before it is. */
  when: z.array(ConditionSchema).default([]),
  /** The day's news it makes: the paper, what happened as the writer is told it, and the milestones it tells of too. */
  news: z
    .object({
      paper: z.enum(NEWS_PAPERS).default('national'),
      /** The love interest the story is about, by id, as a student paper's are. */
      featuring: z.string().optional(),
      brief: z.string(),
      /** Milestones of his (`queen-with-child`, …) this story tells of, so that they are not told again. */
      covers: z.array(z.string()).default([])
    })
    .optional(),
  effects: z.array(EffectSchema).default([]),
  // A memory's level as `MEMORY_LEVELS` has them, written out: the state's schema reads this file's, and not the other way.
  memories: z.array(z.object({ loveInterestId: z.string(), summary: z.string(), level: z.enum(['core', 'normal', 'fleeting']).default('core') })).default([]),
  changes: z.array(CanonChangeSchema).default([])
})
export type CanonCase = z.infer<typeof CanonCaseSchema>

export const CanonStepSchema = z.object({
  id: z.string(),
  /** The day of the game it happens on, counting from 1. */
  day: z.number().int().min(1).optional(),
  /** Or: so many days after another step of the event, and only if that went by the case named (any, left out). */
  after: z.object({ step: z.string(), case: z.string().optional(), days: z.number().int().min(0) }).optional(),
  cases: z.array(CanonCaseSchema).min(1)
})
export type CanonStep = z.infer<typeof CanonStepSchema>

export const CanonEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(CanonStepSchema).min(1)
})
export type CanonEvent = z.infer<typeof CanonEventSchema>

export const CanonSchema = z.object({ events: z.array(CanonEventSchema).default([]) })
export type Canon = z.infer<typeof CanonSchema>

/** Where a step that has happened stands: the case it went by, and the day it happened. */
export const CanonFiredSchema = z.object({ case: z.string(), day: z.number().int().min(0) })
