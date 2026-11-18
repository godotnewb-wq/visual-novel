import { z } from 'zod'
import { ProposalSchema } from './appointment'

/**
 * What can happen between two love interests on its own, with the player nowhere near: a friendship struck up, a
 * falling-out, a feud begun or ended, two of them taking each other to bed or parting, one telling another about him,
 * and two lovers asking him to join them.
 */
export const HAPPENING_KINDS = ['friendship', 'falling-out', 'feud', 'peace', 'spark', 'parting', 'gossip', 'invitation', 'alliance', 'outing'] as const
export type HappeningKind = (typeof HAPPENING_KINDS)[number]

/** What one of them says of him to another: a good word, a warning, or that he has been with her behind the other's back. */
export const GOSSIP_TONES = ['praise', 'warning', 'betrayal'] as const
export type GossipTone = (typeof GOSSIP_TONES)[number]

/**
 * The numbers the social web weighs things with. Every weight is in the same loose units and the heaviest candidate
 * is the likeliest, so the feel of the game can be tuned here without touching code. A pack without this has no web:
 * the women's circles stay as the game began them, apart from what scenes change.
 */
export const SocialConfigSchema = z.object({
  /** The chance that something happens between two of them on a given day, once anything can. */
  dailyChance: z.number().min(0).max(1).default(0.55),
  /** Days after something happens during which nothing else does. */
  cooldownDays: z.number().int().min(0).default(0),
  /** Days after two lovers ask him over before they ask again. */
  invitationDays: z.number().int().min(1).default(14),
  /** Not before anyone is up: what happened in the night is heard of from this hour. */
  fromHour: z.number().int().min(0).default(10),
  /** How many happenings are kept in the save, oldest dropped first. */
  kept: z.number().int().min(1).default(60),

  /**
   * How the kinds weigh against each other on a day when each has someone it could happen to: the mix of what happens,
   * whatever the size of the cast. Within a kind, who it happens to is weighed by what draws them. One set to nothing
   * never happens.
   */
  weights: z
    .object({
      friendship: z.number().default(10),
      fallingOut: z.number().default(7),
      feud: z.number().default(4),
      peace: z.number().default(5),
      spark: z.number().default(6),
      parting: z.number().default(3),
      gossip: z.number().default(12),
      invitation: z.number().default(10),
      /** Two who have found out he has been with them both have it out with him together. */
      alliance: z.number().default(14),
      /** A clique (friends and lovers of one another) goes out together for the evening. One candidate a clique. */
      outing: z.number().default(12)
    })
    .prefault({}),
  /** The most who go out together. */
  outingSize: z.number().int().min(2).default(4),
  /** Days after one of them finds out about the other in which the two can ally against him. */
  allianceDays: z.number().int().min(1).default(10),
  /** What allying against him costs each of them in trust, as they ask him to face them. */
  allianceTrust: z.number().default(-6),
  /** Added to a falling-out, a feud or a parting when both of them have a claim on him: it is over him. */
  overHim: z.number().default(12),
  /** What a friendship between two with nothing in common weighs, in place of `weights.friendship`. */
  acquaintance: z.number().default(2),
  /** Added to a friendship for each thing they share: a class, a society, a friend in common. */
  perCircle: z.number().default(4),
  /** Added to a friendship when they are already friendly, to a spark for every ten points of their tie above what it needs. */
  warm: z.number().default(6),
  /** The tie two friends need before a spark can pass between them. */
  sparkMinTie: z.number().default(30),
  /** How much each of two lovers has to want him before they ask him to join them. */
  invitationMinDesire: z.number().default(40),

  /** What each kind does to how the two feel about each other. */
  tie: z
    .object({
      friendship: z.number().default(12),
      fallingOut: z.number().default(-15),
      feud: z.number().default(-20),
      peace: z.number().default(10),
      spark: z.number().default(15),
      parting: z.number().default(-10),
      /** For each pair of those who went out together. */
      outing: z.number().default(4)
    })
    .prefault({}),
  /** What a word about him does to the one who hears it: a good word, a warning, and finding out he has been with the teller behind her back. */
  gossip: z.object({ praise: z.number().default(3), warning: z.number().default(-4), betrayal: z.number().default(-8) }).prefault({}),
  /** What a quarrel over him costs each of the two in trust. */
  quarrelTrust: z.number().default(-3),
  /** The chance somebody who knows tells him the same day, where someone whose Bloomr he has knows. */
  tellChance: z.number().min(0).max(1).default(0.65),
  /** How much enemies' tie falls each day, towards nothing. */
  enemyDecay: z.number().min(0).default(1),
  /** How much friends' and lovers' tie grows each day: friends' up to `friendsUpTo`, lovers' to the most there is. */
  friendGrowth: z.number().min(0).default(1),
  friendsUpTo: z.number().default(60)
})
export type SocialConfig = z.infer<typeof SocialConfigSchema>

/**
 * One thing that happened between two of them, kept in the save: what and to whom, the account of it (the game's own
 * words until the LLM has written it), who is to tell him, and whether he has heard.
 */
export const HappeningSchema = z.object({
  id: z.string(),
  kind: z.enum(HAPPENING_KINDS),
  /** The day it happened (`toDate(...).dayIndex`), and the game time. */
  day: z.number().int().min(0),
  time: z.number().int().min(0),
  /** Who it happened to: two of them, or a clique out together. For gossip, the teller first and then the one told. */
  ids: z.array(z.string()).min(2),
  /** Where it was, for an outing. */
  locationId: z.string().optional(),
  /** It was about him. */
  overPlayer: z.boolean().default(false),
  /** For gossip: what was said of him. A good word, a warning, or that he has been with the teller behind her back. */
  tone: z.enum(GOSSIP_TONES).optional(),
  /** What happened, as the LLM is told it and as the teller is briefed. */
  account: z.string(),
  /** The LLM has written the account and their memories of it, in place of the game's plain words. */
  written: z.boolean().default(false),
  /** Who tells him, if anyone does: someone whose Bloomr he has. */
  tellerId: z.string().optional(),
  /** She has told him. */
  heard: z.boolean().default(false),
  /** Two lovers' invitation, or two allies' summons: the plan they ask him to. */
  proposal: ProposalSchema.optional()
})
export type Happening = z.infer<typeof HappeningSchema>
