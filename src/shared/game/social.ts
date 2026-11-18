import type { ContentPack, GameState, GossipTone, Happening, HappeningKind, Location, LoveInterest, Proposal } from '../model'
import { proposeMeeting } from './appointments'
import { bondOf, changeTie, statusOf, tieLevel, tieOf } from './bonds'
import { formatDate, toDate } from './calendar'
import { hasContact } from './courier'
import { addMemory, amendMemory, applyFeelings, timesIntimate } from './memory'
import { noteTogether, onFriendlyTerms, relationBetween, setRelation } from './rapport'
import { stageFor, stageRank } from './relationships'
import { firstNames, hasMet } from './scene'
import { isOpen } from './schedule'
import { t, type MessageKey } from '../i18n'

/**
 * The social web: what happens between the love interests when he is not there. Once a day every pair of them is
 * weighed for each thing that could pass between them (a friendship struck up, a falling-out, a feud or a peace, two
 * of them becoming lovers or parting, one telling another about him, two lovers asking him to join them), and at most
 * one happens, by the day's luck. The engine changes what they are to each other and how they feel, writes each of
 * them a plain memory of it, and names who tells him, if anyone whose Bloomr he has would. The LLM then writes the
 * account and the memories in its own words in the background, and the teller's DM; the game goes on the same
 * whether or not it ever does.
 */

// Traits that make a spark between two women likelier, and the one that puts it out.
const SPARK_TRAITS = ['promiscuous', 'flirtatious', 'sex-addict', 'exhibitionist']
const PRUDE = 'prude'
const COMPETITIVE = 'competitive'
// The desire at which someone who is only a friend counts as wanting him, for a quarrel to be over him.
const WANTING_DESIRE = 50
// What a teller's account is cut to in her DM's brief, which has a limit of its own.
const BRIEF_CHARS = 400
// How much of an account and a memory the LLM may write. More is cut at the last sentence that fits.
const ACCOUNT_CHARS = 900
const MEMORY_CHARS = 400

/** The text, or as much of it as fits, cut at the end of a sentence; a run with no sentence end in it is cut short with an ellipsis. */
export function cutAtSentence(text: string, most: number): string {
  if (text.length <= most) return text
  const fits = text.slice(0, most)
  const ends = [...fits.matchAll(/[.!?…][”"')]?(?=\s|$)/g)]
  const last = ends.at(-1)
  return last && last.index !== undefined && last.index > most / 3 ? fits.slice(0, last.index + last[0].length) : `${fits.slice(0, most - 1).trimEnd()}…`
}
// The draws of a day's roll that are the web's: whether anything happens, what, and who tells him.
const HAPPENS_DRAW = 1
const WHICH_DRAW = 2
const WHOM_DRAW = 5
const TELLS_DRAW = 3
const TELLER_DRAW = 4
// Where each clique would go, one draw a clique from here on.
const PLACE_DRAW = 10
// The hour a night out is at, for whether a place is open for one.
const EVENING_HOUR = 20
const NO_RELATIONSHIP = { affection: 0, trust: 0, desire: 0 }

/** A repeatable number in [0, 1) for one day of one game. */
function roll(seed: number, dayIndex: number, salt: number): number {
  let x = (seed ^ Math.imul(dayIndex + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x7f4a7c15) ^ 0x5bd1e995) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
  return ((x ^ (x >>> 16)) >>> 0) / 0x100000000
}

/** Whether today's web is still to be looked at: once a day, from the hour anyone is up. */
export function socialDue(content: ContentPack, state: GameState): boolean {
  if (!content.social) return false
  const date = toDate(content.calendar, state.time)
  return date.dayIndex > state.socialDay && date.hour >= content.social.fromHour
}

/** One thing that could happen today, and how strongly it pulls. For gossip the teller is first. */
export interface Candidate {
  kind: HappeningKind
  /** Two of them, or a clique out together. */
  ids: string[]
  weight: number
  overPlayer: boolean
  tone?: GossipTone
  /** Where an outing goes. */
  locationId?: string
}

/** What a kind weighs against the others, from the pack. */
function kindWeight(config: NonNullable<ContentPack['social']>, kind: HappeningKind): number {
  return kind === 'falling-out' ? config.weights.fallingOut : config.weights[kind]
}

/** Whether she has a right to mind him being with someone else: an arrangement with him, dating him, or wanting him. */
function hasClaim(content: ContentPack, state: GameState, id: string): boolean {
  const rel = state.relationships[id]
  if (!rel) return false
  if (bondOf(state, id)) return true
  const stages = content.relationships
  return stageRank(stages, stageFor(stages, rel.affection).id) >= stageRank(stages, 'dating') || rel.desire >= WANTING_DESIRE
}

/** Whether she has promised him to see only him, and that promise leaves the other out. */
function promisedAgainst(content: ContentPack, state: GameState, id: string, other: string): boolean {
  const bond = bondOf(state, id)
  return bond !== undefined && statusOf(content, bond)?.exclusive === true && !bond.memberIds.includes(other)
}

/** How many things two of them share: a class, a society, a friend in common. */
function circles(content: ContentPack, state: GameState, a: string, b: string): number {
  const classes = (content.catalogue?.courses ?? []).filter((course) => {
    const members = course.teacherId ? [course.teacherId, ...course.studentIds] : course.studentIds
    return members.includes(a) && members.includes(b)
  }).length
  const societies = (content.societies?.societies ?? []).filter((society) => {
    const members = society.sponsorId ? [...society.memberIds, society.sponsorId] : society.memberIds
    return members.includes(a) && members.includes(b)
  }).length
  const mutual = (state.rapport[a]?.friends ?? []).filter((id) => state.rapport[b]?.friends.includes(id)).length
  return classes + societies + mutual
}

/** What the traits of both add up to in jealousy, in sociability, in a leaning to a spark, and whether either is competitive or a prude. */
function traitsOf(content: ContentPack, pair: LoveInterest[]) {
  const traits = pair.flatMap((li) => content.traits.filter((trait) => li.traitIds.includes(trait.id)))
  return {
    jealousy: traits.reduce((sum, trait) => sum + trait.drama.jealousy, 0),
    sociable: traits.reduce((sum, trait) => sum + trait.drama.sociable, 0),
    spark: traits.filter((trait) => SPARK_TRAITS.includes(trait.id)).length,
    competitive: traits.some((trait) => trait.id === COMPETITIVE),
    prude: traits.some((trait) => trait.id === PRUDE)
  }
}

/** The tie level's floor named `friendly` in the default pack: the second level, whatever it is called. */
function friendlyAt(content: ContentPack): number {
  const levels = [...content.relationships.tieLevels].sort((x, y) => x.min - y.min)
  return levels[1]?.min ?? 15
}

/** What one of them would say of him to another, if anything: a good word, a warning, or nothing to tell. */
function gossipTone(content: ContentPack, state: GameState, teller: string, hearer: string): GossipTone | undefined {
  const said = state.relationships[teller] ?? NO_RELATIONSHIP
  const bond = bondOf(state, hearer)
  // She has been with him, and the one she tells was promised he sees nobody else.
  if (timesIntimate(state, teller) > 0 && bond && statusOf(content, bond)?.exclusive && !bond.memberIds.includes(teller)) return 'betrayal'
  const stages = content.relationships
  const fond = stageRank(stages, stageFor(stages, said.affection).id) >= stageRank(stages, 'friend')
  if (fond && said.trust >= 40) return 'praise'
  if (said.trust < 25 && said.affection < 30) return 'warning'
  return undefined
}

/**
 * When and where two of them would have him come to them both: at the first one's room, or wherever she is found,
 * with what the scene is for on the plan. For two lovers, a night; for two allies, having it out with him.
 */
function planWith(content: ContentPack, state: GameState, kind: 'invitation' | 'alliance', a: LoveInterest, b: LoveInterest): Proposal | undefined {
  const place = a.room?.locationId ?? a.schedule.map((entry) => entry.locationId).find((id) => id !== content.coursework?.locationId)
  if (!place) return undefined
  const { proposal } = proposeMeeting(content, state, a.id, { activity: t(kind === 'invitation' ? 'game.social.invitationTitle' : 'game.social.allianceTitle'), place, with: [b.id] })
  if (!proposal) return undefined
  const first = (id: string) => firstNames(content, [id])
  const direction = t(kind === 'invitation' ? 'game.social.direction.invitation' : 'game.social.direction.alliance', { a: first(a.id), b: first(b.id), player: state.player.name, leaves: '[LEAVES: Name=feeling why]' })
  return { ...proposal, direction }
}

/**
 * Whether one of them has lately found out about the other (told that he has been with her, behind a promise) and the
 * two have not yet come to him over it. Either way round: the one told asks him to face them.
 */
function betrayalBetween(config: NonNullable<ContentPack['social']>, state: GameState, a: string, b: string, day: number): Happening | undefined {
  const found = [...state.happenings].reverse().find((one) => one.kind === 'gossip' && one.tone === 'betrayal' && one.ids.includes(a) && one.ids.includes(b) && day - one.day <= config.allianceDays)
  if (!found) return undefined
  const since = state.happenings.some((one) => one.kind === 'alliance' && one.ids.includes(a) && one.ids.includes(b) && one.day >= found.day)
  return since ? undefined : found
}

/**
 * Everything that could happen today between any two of them, weighed. Every pair is looked at for each kind it could
 * have; a kind that needs more than the pair has (a spark between two who are barely friendly, an invitation from two
 * who do not both want him) is not a candidate at all.
 */
export function candidates(content: ContentPack, state: GameState): Candidate[] {
  const config = content.social
  if (!config) return []
  const day = toDate(content.calendar, state.time).dayIndex
  const friendly = friendlyAt(content)
  const found: Candidate[] = []
  // A kind whose weight the pack sets to nothing never happens, whatever would add to it.
  const push = (candidate: Candidate, base: number) => {
    if (base > 0 && candidate.weight > 0) found.push(candidate)
  }
  const cast = content.loveInterests.filter((li) => state.relationships[li.id] !== undefined)
  for (const [i, a] of cast.entries()) {
    for (const b of cast.slice(i + 1)) {
      const relation = relationBetween(state, a.id, b.id)
      const tie = tieOf(content, state, a.id, b.id)
      const traits = traitsOf(content, [a, b])
      const overHim = hasClaim(content, state, a.id) && hasClaim(content, state, b.id)
      const over = overHim ? config.overHim : 0
      const ids = [a.id, b.id]

      if (relation === 'neither') {
        // Two who share nothing seldom become friends, and never quarrel: a feud needs him, a circle, or a temper.
        const shared = circles(content, state, a.id, b.id)
        const known = shared > 0 || tie >= friendly
        push({ kind: 'friendship', ids, overPlayer: false, weight: (known ? config.weights.friendship : config.acquaintance) + shared * config.perCircle + (tie >= friendly ? config.warm : 0) + traits.sociable }, config.weights.friendship)
        const temper = Math.max(0, traits.jealousy) / 2 + (traits.competitive ? 2 : 0)
        if (tie < friendly && (overHim || shared > 0 || temper > 0)) push({ kind: 'feud', ids, overPlayer: overHim, weight: config.weights.feud + temper + over + (shared > 0 ? config.perCircle : 0) }, config.weights.feud)
      }
      if (relation === 'friends') {
        push({ kind: 'falling-out', ids, overPlayer: overHim, weight: config.weights.fallingOut + Math.max(0, traits.jealousy) + over + Math.max(0, friendly * 2 - tie) / 3 }, config.weights.fallingOut)
        const promised = promisedAgainst(content, state, a.id, b.id) || promisedAgainst(content, state, b.id, a.id)
        if (tie >= config.sparkMinTie && !traits.prude && !promised) {
          push({ kind: 'spark', ids, overPlayer: false, weight: config.weights.spark + traits.spark * 4 + config.warm * Math.floor((tie - config.sparkMinTie) / 10) }, config.weights.spark)
        }
      }
      if (relation === 'enemies') {
        push({ kind: 'peace', ids, overPlayer: false, weight: config.weights.peace + circles(content, state, a.id, b.id) * config.perCircle + Math.max(0, -traits.jealousy) / 2 + tie / 5 }, config.weights.peace)
      }
      if (relation === 'lovers') {
        push({ kind: 'parting', ids, overPlayer: overHim, weight: config.weights.parting + Math.max(0, traits.jealousy) + over }, config.weights.parting)
        const relA = state.relationships[a.id] ?? NO_RELATIONSHIP
        const relB = state.relationships[b.id] ?? NO_RELATIONSHIP
        const stages = content.relationships
        const friendsWithHim = (rel: typeof relA) => stageRank(stages, stageFor(stages, rel.affection).id) >= stageRank(stages, 'friend')
        const lately = state.happenings.some((one) => one.kind === 'invitation' && one.ids.includes(a.id) && one.ids.includes(b.id) && day - one.day < config.invitationDays)
        const promised = promisedAgainst(content, state, a.id, b.id) || promisedAgainst(content, state, b.id, a.id)
        if (
          !lately &&
          !promised &&
          hasContact(state, a.id) &&
          hasContact(state, b.id) &&
          relA.desire >= config.invitationMinDesire &&
          relB.desire >= config.invitationMinDesire &&
          friendsWithHim(relA) &&
          friendsWithHim(relB)
        ) {
          push({ kind: 'invitation', ids, overPlayer: true, weight: config.weights.invitation + (relA.desire + relB.desire) / 20 }, config.weights.invitation)
        }
      }
      // Two who have found out he has been with them both close ranks: the one told asks him to face the two of them.
      const betrayal = betrayalBetween(config, state, a.id, b.id, day)
      if (betrayal && hasContact(state, betrayal.ids[1]) && hasMet(state, a.id) && hasMet(state, b.id)) {
        push({ kind: 'alliance', ids: [betrayal.ids[1], betrayal.ids[0]], overPlayer: true, weight: config.weights.alliance + Math.max(0, traits.jealousy) }, config.weights.alliance)
      }
      // A word about him passes either way between two who are not enemies, when the teller has something to say.
      if (relation !== 'enemies' && hasMet(state, a.id) && hasMet(state, b.id)) {
        for (const [teller, hearer] of [
          [a.id, b.id],
          [b.id, a.id]
        ]) {
          const tone = gossipTone(content, state, teller, hearer)
          if (tone) push({ kind: 'gossip', ids: [teller, hearer], overPlayer: true, tone, weight: config.weights.gossip + (onFriendlyTerms(state, teller, hearer) ? 6 : 0) + (tone === 'betrayal' ? 8 : 0) }, config.weights.gossip)
        }
      }
    }
  }
  // Each clique may go out together: one candidate a clique, where there is somewhere to go.
  const places = outingPlaces(content)
  if (places.length > 0) {
    for (const [i, clique] of cliques(content, state, cast.map((li) => li.id)).entries()) {
      const members = clique.map((id) => cast.find((li) => li.id === id)!)
      const sociable = traitsOf(content, members).sociable
      const place = places[Math.floor(roll(state.weatherSeed, day, PLACE_DRAW + i) * places.length)]
      push({ kind: 'outing', ids: clique, overPlayer: false, locationId: place.id, weight: config.weights.outing + Math.min(sociable, 8) }, config.weights.outing)
    }
  }
  return found
}

/** Where a clique can go of an evening: anywhere public that is open then and is not the lecture halls. */
function outingPlaces(content: ContentPack): Location[] {
  return content.locations.filter((place) => !place.private && !place.eventOnly && place.id !== content.coursework?.locationId && isOpen(place, EVENING_HOUR))
}

/**
 * The cliques: everyone joined to everyone else by friendship or love, each clique at most `outingSize` strong (the
 * best-connected of a larger circle and those closest to her). Someone with no friend is in none. In a fixed order,
 * so that the day's luck falls the same way for the same game.
 */
export function cliques(content: ContentPack, state: GameState, ids: string[]): string[][] {
  const config = content.social!
  const sorted = [...ids].sort()
  const seen = new Set<string>()
  const found: string[][] = []
  for (const start of sorted) {
    if (seen.has(start)) continue
    // Everyone reachable from her along friendships and loves.
    const circle: string[] = []
    const queue = [start]
    seen.add(start)
    while (queue.length > 0) {
      const id = queue.shift()!
      circle.push(id)
      for (const other of sorted) if (!seen.has(other) && onFriendlyTerms(state, id, other)) seen.add(other), queue.push(other)
    }
    if (circle.length < 2) continue
    if (circle.length <= config.outingSize) {
      found.push(circle.sort())
      continue
    }
    const friendsOf = (id: string) => circle.filter((other) => other !== id && onFriendlyTerms(state, id, other)).length
    const heart = [...circle].sort((x, y) => friendsOf(y) - friendsOf(x) || x.localeCompare(y))[0]
    const closest = circle
      .filter((id) => id !== heart)
      .sort((x, y) => tieOf(content, state, heart, y) - tieOf(content, state, heart, x) || x.localeCompare(y))
      .slice(0, config.outingSize - 1)
    found.push([heart, ...closest].sort())
  }
  return found
}

/** Who tells him what happened, if anyone: one of the two if he has her Bloomr, else a friend or lover of either. */
function tellerOf(content: ContentPack, state: GameState, candidate: Candidate, day: number): string | undefined {
  const config = content.social!
  if (candidate.kind === 'invitation' || candidate.kind === 'alliance') return candidate.ids[0]
  if (roll(state.weatherSeed, day, TELLS_DRAW) >= config.tellChance) return undefined
  // The one told about him, or any of those it happened to, tells it first-hand; their friends, second-hand.
  const own = (candidate.kind === 'gossip' ? [candidate.ids[1]] : candidate.ids).filter((id) => hasContact(state, id))
  const friends = content.loveInterests.map((li) => li.id).filter((id) => !candidate.ids.includes(id) && hasContact(state, id) && candidate.ids.some((one) => onFriendlyTerms(state, id, one)))
  const pool = own.length > 0 ? own : friends
  if (pool.length === 0) return undefined
  return pool[Math.floor(roll(state.weatherSeed, day, TELLER_DRAW) * pool.length)]
}

type Told = Pick<Happening, 'kind' | 'ids' | 'overPlayer' | 'tone' | 'locationId'>

/** The names a happening's words are written with: the first two of them, all of them, him, and where it was. */
function names(content: ContentPack, state: GameState, happening: Told) {
  const place = content.locations.find((l) => l.id === happening.locationId)?.name ?? ''
  return { a: firstNames(content, [happening.ids[0]]), b: firstNames(content, [happening.ids[1]]), names: firstNames(content, happening.ids), player: state.player.name, place }
}

/** What happened, in the game's own words, as the LLM is told it until it has written its own. */
export function happeningAccount(content: ContentPack, state: GameState, happening: Told): string {
  return t(`game.social.account.${happening.kind}` as MessageKey, { ...names(content, state, happening), overHim: happening.overPlayer, tone: happening.tone ?? '' })
}

/** What one of those it happened to remembers of it, in the game's own words: hers, in the second person. */
export function happeningMemory(content: ContentPack, state: GameState, happening: Told, forId: string): string {
  const other = firstNames(content, happening.ids.filter((id) => id !== forId))
  return t(`llm.social.memory.${happening.kind}` as MessageKey, { other, place: names(content, state, happening).place, player: state.player.name, overHim: happening.overPlayer, tone: happening.tone ?? '', told: happening.ids[0] === forId })
}

/** What the happening does: who they now are to each other, how they feel about each other, and what it does to how they feel about him. */
function happen(content: ContentPack, state: GameState, candidate: Candidate): GameState {
  const config = content.social!
  const [a, b] = candidate.ids
  const quarrel = (next: GameState) =>
    candidate.overPlayer
      ? [a, b].reduce((after, id) => applyFeelings(content, after, id, { affection: 0, trust: config.quarrelTrust, desire: 0, reason: t('llm.social.quarrelReason') }, true), next)
      : next
  switch (candidate.kind) {
    case 'friendship':
      return changeTie(content, setRelation(state, a, b, 'friends'), a, b, config.tie.friendship)
    case 'falling-out':
      return quarrel(changeTie(content, setRelation(state, a, b, 'neither'), a, b, config.tie.fallingOut))
    case 'feud':
      return quarrel(changeTie(content, setRelation(state, a, b, 'enemies'), a, b, config.tie.feud))
    case 'peace':
      return changeTie(content, setRelation(state, a, b, 'neither'), a, b, config.tie.peace)
    case 'spark':
      return changeTie(content, setRelation(state, a, b, 'lovers'), a, b, config.tie.spark)
    case 'parting':
      // Parted over him, they are not even friends any more.
      return quarrel(changeTie(content, setRelation(state, a, b, candidate.overPlayer ? 'neither' : 'friends'), a, b, config.tie.parting))
    case 'gossip': {
      const amount = config.gossip[candidate.tone ?? 'praise']
      const feelings =
        candidate.tone === 'praise'
          ? { affection: amount, trust: 0, desire: 0 }
          : candidate.tone === 'warning'
            ? { affection: 0, trust: amount, desire: 0 }
            : { affection: Math.round(amount / 2), trust: amount, desire: 0 }
      return applyFeelings(content, state, b, { ...feelings, reason: t('llm.social.gossipReason', { tone: candidate.tone ?? '' }) }, true)
    }
    case 'invitation':
      return state
    case 'outing': {
      // A night out brings everyone who was there a little closer.
      let after = state
      for (const [i, x] of candidate.ids.entries()) for (const y of candidate.ids.slice(i + 1)) after = changeTie(content, after, x, y, config.tie.outing)
      return after
    }
    case 'alliance':
      // Allies in this, whatever they were: each trusts him the less for it.
      return [a, b].reduce(
        (after, id) => applyFeelings(content, after, id, { affection: 0, trust: config.allianceTrust, desire: 0, reason: t('llm.social.allianceReason') }, true),
        changeTie(content, relationBetween(state, a, b) === 'lovers' ? state : setRelation(state, a, b, 'friends'), a, b, config.tie.friendship)
      )
  }
}

/**
 * The day's web: enemies' ties cool a little, and then one thing may happen between two of them, by the day's luck and
 * what each candidate weighs. It is applied at once, each of the two gets a plain memory of it, and it is kept with
 * who is to tell him. The same day of the same game always goes the same way.
 */
export function socialRound(content: ContentPack, state: GameState): GameState {
  const config = content.social
  const day = toDate(content.calendar, state.time).dayIndex
  let next: GameState = { ...state, socialDay: day }
  if (!config) return next
  // Enemies drift apart when nothing brings them together; friends and lovers grow closer for the time they spend together.
  const ids = content.loveInterests.map((li) => li.id)
  for (const [i, a] of ids.entries()) {
    for (const b of ids.slice(i + 1)) {
      const relation = relationBetween(next, a, b)
      const tie = tieOf(content, next, a, b)
      if (relation === 'enemies' && tie > 0 && config.enemyDecay > 0) next = changeTie(content, next, a, b, -config.enemyDecay)
      if (relation === 'friends' && tie < config.friendsUpTo && config.friendGrowth > 0) next = changeTie(content, next, a, b, Math.min(config.friendGrowth, config.friendsUpTo - tie))
      if (relation === 'lovers' && config.friendGrowth > 0) next = changeTie(content, next, a, b, config.friendGrowth)
    }
  }
  // Nothing so soon after the last thing.
  const last = state.happenings.at(-1)
  if (last && day - last.day <= config.cooldownDays) return next
  const all = candidates(content, next)
  if (all.length === 0 || roll(state.weatherSeed, day, HAPPENS_DRAW) >= config.dailyChance) return next
  // What kind of thing happens is picked first, by the kinds' own weights among those that have anyone to happen to, so
  // that the mix is the pack's to set whatever the size of the cast; then to whom, by how strongly each pull.
  const kinds = [...new Set(all.map((one) => one.kind))]
  const kindTotal = kinds.reduce((sum, kind) => sum + kindWeight(config, kind), 0)
  let pickKind = roll(state.weatherSeed, day, WHICH_DRAW) * kindTotal
  const kind = kinds.find((one) => (pickKind -= kindWeight(config, one)) < 0) ?? kinds[kinds.length - 1]
  const ofKind = all.filter((one) => one.kind === kind)
  const total = ofKind.reduce((sum, one) => sum + one.weight, 0)
  let pick = roll(state.weatherSeed, day, WHOM_DRAW) * total
  const chosen = ofKind.find((one) => (pick -= one.weight) < 0) ?? ofKind[ofKind.length - 1]

  let happening: Happening = {
    id: `happening-${day}-${state.time}`,
    kind: chosen.kind,
    day,
    time: state.time,
    ids: chosen.ids,
    overPlayer: chosen.overPlayer,
    ...(chosen.tone && { tone: chosen.tone }),
    ...(chosen.locationId && { locationId: chosen.locationId }),
    account: '',
    written: false,
    heard: false
  }
  if (chosen.kind === 'invitation' || chosen.kind === 'alliance') {
    const [a, b] = chosen.ids.map((id) => content.loveInterests.find((li) => li.id === id)!)
    const proposal = planWith(content, next, chosen.kind, a, b)
    // Nowhere and no time to ask him to: nothing happens today.
    if (!proposal) return next
    happening = { ...happening, proposal }
  }
  happening = { ...happening, account: happeningAccount(content, next, happening) }
  const tellerId = tellerOf(content, next, chosen, day)
  if (tellerId) happening = { ...happening, tellerId }
  next = happen(content, next, chosen)
  for (const id of happening.ids) next = addMemory(next, id, happeningMemory(content, next, happening, id))
  return { ...next, happenings: [...next.happenings, happening].slice(-config.kept) }
}

/** The happenings the LLM has still to write, or whose teller has still to write to him: what the background works through. */
export function pendingHappenings(state: GameState): Happening[] {
  return state.happenings.filter((one) => !one.written || (one.tellerId !== undefined && !one.heard))
}

/** What the LLM writes of a happening: the account, and each of the two's memory of it. */
export interface WrittenHappening {
  account: string
  memories: Record<string, string>
}

/** How she stands with him, for the writer: her stage, and any arrangement. */
function standing(content: ContentPack, state: GameState, id: string): string {
  const rel = state.relationships[id] ?? NO_RELATIONSHIP
  const stage = stageFor(content.relationships, rel.affection)
  const status = statusOf(content, bondOf(state, id))
  return t('llm.social.standing', { name: firstNames(content, [id]), player: state.player.name, stage: stage.name, bond: Boolean(status), status: status?.name ?? '', intimate: timesIntimate(state, id) > 0 })
}

/** The prompt asking the LLM to write what happened between the two of them, and what each remembers of it. */
export function buildHappeningPrompt(content: ContentPack, state: GameState, happening: Happening): { system: string; user: string } {
  const people = happening.ids.map((id) => content.loveInterests.find((li) => li.id === id))
  if (people.some((li) => li === undefined)) throw new Error(`Unknown love interests in happening "${happening.id}"`)
  const cast = people as LoveInterest[]
  const [a, b] = cast
  const player = state.player.name
  const who = (li: LoveInterest) =>
    [
      t('llm.social.who', { name: li.name, age: li.age, bio: li.bio, personality: li.personality }),
      ...content.traits.filter((trait) => li.traitIds.includes(trait.id)).map((trait) => `- ${trait.name}: ${trait.definition}`),
      // What she has lately been through, so the account follows from it.
      ...(state.memories[li.id] ?? [])
        .slice(-3, -1)
        .map((memory) => t('llm.social.remembers', { name: li.name.split(' ')[0], summary: memory.summary }))
    ].join('\n')
  const tie = tieOf(content, state, a.id, b.id)
  const level = tieLevel(content, tie)
  const place = content.locations.find((l) => l.id === happening.locationId)
  const system = [
    t('llm.social.system', { player }),
    t('llm.social.reply', { format: `{"account": string, "memories": {${cast.map((li) => `"${li.id}": string`).join(', ')}}}`, names: firstNames(content, happening.ids), player }),
    t('llm.social.rules', { player })
  ].join('\n')
  const user = [
    t('llm.social.today', { date: formatDate(toDate(content.calendar, state.time)) }),
    ...cast.flatMap((li) => ['', who(li)]),
    '',
    // How the two stood, for a thing between two; the clique and its night, for an outing.
    ...(happening.kind === 'outing'
      ? [t('llm.social.outing', { place: place?.name ?? '', description: place?.description ?? '' })]
      : [t('llm.social.between', { a: a.name.split(' ')[0], b: b.name.split(' ')[0], level: level?.name ?? '', description: level?.description ?? '' })]),
    ...(happening.overPlayer || happening.kind === 'gossip' ? cast.map((li) => standing(content, state, li.id)) : []),
    '',
    t('llm.social.happened', { account: happeningAccount(content, state, happening) })
  ].join('\n')
  return { system, user }
}

/** What a reply makes of it: the JSON object in it, cut to length. Undefined when it cannot be read. */
export function parseHappeningReply(reply: string, happening: Pick<Happening, 'ids'>): WrittenHappening | undefined {
  const found = /\{[\s\S]*\}/.exec(reply.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, ''))
  if (!found) return undefined
  let read: Record<string, unknown>
  try {
    read = JSON.parse(found[0]) as Record<string, unknown>
  } catch {
    return undefined
  }
  const text = (value: unknown, most: number) => (typeof value === 'string' ? cutAtSentence(value.replace(/\s+/g, ' ').trim(), most) : '')
  const account = text(read.account, ACCOUNT_CHARS)
  if (account === '') return undefined
  const given = (read.memories ?? {}) as Record<string, unknown>
  const memories: Record<string, string> = {}
  for (const id of happening.ids) {
    const key = Object.keys(given).find((one) => one.toLowerCase() === id.toLowerCase())
    const memory = key ? text(given[key], MEMORY_CHARS) : ''
    if (memory !== '') memories[id] = memory
  }
  return { account, memories }
}

/**
 * Puts what the LLM wrote in place of the game's plain words: the account, and each memory where the plain one still
 * stands. A happening already written is left as it is.
 */
export function writeHappening(content: ContentPack, state: GameState, id: string, written: WrittenHappening): GameState {
  const happening = state.happenings.find((one) => one.id === id)
  if (!happening || happening.written) return state
  let next: GameState = { ...state, happenings: state.happenings.map((one) => (one.id === id ? { ...one, account: written.account, written: true } : one)) }
  for (const who of happening.ids) {
    const to = written.memories[who]
    if (to) next = amendMemory(next, who, happeningMemory(content, state, happening, who), to)
  }
  return next
}

/** He has been told: what the two are to each other is his to know from now on. Nothing else of it is shown to him. */
export function hearHappening(state: GameState, id: string): GameState {
  const happening = state.happenings.find((one) => one.id === id)
  if (!happening || happening.heard) return state
  const heard = { ...state, happenings: state.happenings.map((one) => (one.id === id ? { ...one, heard: true } : one)) }
  return noteTogether(heard, [...happening.ids])
}

/** Nobody is going to tell him after all: the teller is let off, so the background does not ask her again. */
export function untoldHappening(state: GameState, id: string): GameState {
  return { ...state, happenings: state.happenings.map((one) => (one.id === id ? { ...one, tellerId: undefined } : one)) }
}

/** What the teller is told she has to tell him, for her DM: the account, and whether she was part of it. */
export function tellingBrief(content: ContentPack, state: GameState, happening: Happening): string {
  const tellerId = happening.tellerId ?? happening.ids[0]
  if ((happening.kind === 'invitation' || happening.kind === 'alliance') && happening.proposal) {
    const other = firstNames(content, [happening.ids[1]])
    const where = content.locations.find((l) => l.id === happening.proposal!.locationId)?.name ?? happening.proposal.locationId
    return t(happening.kind === 'invitation' ? 'llm.social.invite' : 'llm.social.ally', { other, where, player: state.player.name })
  }
  const part = happening.ids.includes(tellerId)
  const account = cutAtSentence(happening.account, BRIEF_CHARS)
  return t('llm.social.tell', { account, part, hearer: happening.kind === 'gossip' && happening.ids[1] === tellerId, player: state.player.name })
}
