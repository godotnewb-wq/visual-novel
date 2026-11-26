import type { ContentPack, GameState, Scene } from '../model'
import type { SaveData } from '../saves'
import { reconcileEncounterNotes, stageWitnesses } from './encounterNotes'
import { skillLevel } from './skills'
import { applyDualTurnEffects, type DualTurnEffects } from './dualTurnEffects'
import { arrivalCue, dramaDue, fireDrama } from './drama'
import { newStrangers } from './strangers'
import { meet, firstNames, sceneCast } from './scene'
import { bringPresents } from './presents'
import { t } from '../i18n'
import { KEPT_ACROSS, MAX_TURNS_KEPT, packTurns, rewound, unpackTurns, withBackground, type Turn } from './turns'

export interface DualCheckpoint {
  turnId: string; sceneId: string; revision: number; contentRevision: string
  before: { state: GameState; scene: Scene }; state: GameState; asked: Scene
  text?: string; offered?: Scene['proposal']; notice?: string
  animationEnded?: boolean
}
export interface GameSession {
  state: GameState; scene: Scene | null; turns: Turn[]; ended: boolean; walkingWith: string[] | null; sleepingOver: boolean
  revision: number; pending?: DualCheckpoint
}
export function createGameSession(saved: SaveData): GameSession {
  const completion = saved.scene?.generation?.mode === 'dual' ? saved.scene.generation.completion : undefined
  return { state: saved.state, scene: saved.scene, turns: saved.scene ? unpackTurns(saved.turns ?? [], saved.state, saved.scene) : [],
    revision: 0, ended: !!completion && completion.kind !== 'continue', walkingWith: completion?.kind === 'walk' ? completion.withIds : null,
    sleepingOver: completion?.kind === 'sleep' }
}

export function prepareDualCheckpoint(content: ContentPack, session: GameSession, turnId: string, contentRevision: string,
  options: { text?: string; ask?: string; backgroundId?: string; offered?: Scene['proposal'] } = {}): DualCheckpoint {
  const scene = session.scene
  if (!scene || scene.generation?.mode !== 'dual' || session.pending || session.ended) throw new Error('dual-turn-unavailable')
  const arrival = dramaDue(content, session.state, scene) ? fireDrama(content, session.state, scene) : undefined
  const from = arrival?.scene ?? scene, at = arrival?.state ?? session.state
  const cue = [arrival && from.drama ? arrivalCue(content, from.drama) : undefined, options.ask].filter(Boolean).join(' ') || undefined
  const strangers = newStrangers(content, at, from)
  const brought = from.npc ? { state: at, presents: [] } : bringPresents(content, meet(content, at, sceneCast(from)), sceneCast(from))
  const text = options.text?.replace(/\r\n/g, '\n')
  const asked: Scene = { ...from, strangers: [...new Set([...(from.strangers ?? []), ...strangers])],
    ...(brought.presents.length && { presents: [...(from.presents ?? []), ...brought.presents] }),
    backgroundId: from.viewId ?? options.backgroundId ?? from.backgroundId,
    messages: text === undefined ? from.messages : [...from.messages, { role: 'user', content: text, ...(cue && { cue }) }] }
  return { turnId, contentRevision, sceneId: scene.generation.sceneId, revision: session.revision,
    before: { state: session.state, scene }, state: brought.state, asked: stageWitnesses(asked, scene.messages.length, scene.beats.length), text, offered: options.offered,
    notice: [arrival?.notice, ...brought.presents.map((present) => t('shell.app.gavePresent', { who: firstNames(content, [present.fromId]),
      item: content.items.find((item) => item.id === present.itemId)?.name ?? t('shell.app.aPresent') }))].filter(Boolean).join(' ') }
}

export function saveGameSession(session: Pick<GameSession, 'state' | 'scene' | 'turns'>): SaveData {
  const { state, scene, turns } = session, unanswered = scene?.messages.at(-1)?.role === 'user'
  const kept = scene && unanswered ? { ...scene, messages: scene.messages.slice(0, -1) } : scene
  return { state, scene: kept, turns: kept ? packTurns(unanswered ? turns.slice(0, -1) : turns, state, kept) : undefined }
}

export function dialogueScene(session: GameSession): Scene | null {
  return session.pending && session.scene ? { ...session.scene, messages: session.pending.asked.messages } : session.scene
}

export interface DualReady {
  turnId: string; sceneId: string; revision: number; contentRevision: string; effects: DualTurnEffects
}
export function commitDualReady(content: ContentPack, session: GameSession, ready: DualReady): GameSession {
  const pending = session.pending
  if (!pending || ready.turnId !== pending.turnId || ready.sceneId !== pending.sceneId || ready.revision !== session.revision
    || pending.revision !== session.revision || ready.contentRevision !== pending.contentRevision || session.scene?.generation?.mode !== 'dual'
    || session.scene.generation.sceneId !== ready.sceneId || session.scene.generation.lastCommittedTurnId === ready.turnId) return session
  const applied = applyDualTurnEffects(content, withBackground(pending.state, session.state), pending.asked, ready.effects, pending.offered)
  const noted = reconcileEncounterNotes(stageWitnesses(applied.scene, applied.scene.messages.length, pending.asked.beats.length), ready.effects.noteChanges)
  if (noted.generation?.mode !== 'dual') return session
  const floor = skillLevel(content, pending.state, 'comfort') === 2 ? 2 : 1
  const comfortHistory = { ...(noted.generation.comfortHistory ?? {}) }
  for (const [id, reading] of Object.entries(ready.effects.comfort)) comfortHistory[id] = [...(comfortHistory[id] ?? []), { ...reading, level: Math.max(floor, reading.level) }].slice(-2)
  const cast = new Set(sceneCast(noted))
  const scene: Scene = { ...noted, generation: { ...noted.generation, lastCommittedTurnId: ready.turnId, comfortHistory,
    witnesses: noted.generation.witnesses?.map((range) => range.toMessage === null && !cast.has(range.actorId) ? { ...range, toMessage: noted.messages.length } : range),
    turnHistory: [...(noted.generation.turnHistory ?? []), { turnId: ready.turnId, fromMessage: pending.before.scene.messages.length, toMessage: noted.messages.length }].slice(-128),
    nextTurnOrdinal: noted.generation.nextTurnOrdinal + 1, completion: ready.effects.sleptOver ? { kind: 'sleep' }
      : ready.effects.walkTo ? { kind: 'walk', withIds: ready.effects.walkTo.withIds }
      : ready.effects.sceneEnded ? { kind: 'end' } : { kind: 'continue' } } }
  const turns = pending.text === undefined ? session.turns : [...session.turns,
    { state: pending.before.state, scene: pending.animationEnded ? { ...pending.before.scene,
      animationId: undefined, animationOf: undefined, animationGroup: undefined } : pending.before.scene, text: pending.text }].slice(-MAX_TURNS_KEPT)
  return { ...session, state: applied.state, scene, turns, revision: session.revision + 1,
    pending: undefined, ended: ready.effects.sceneEnded, walkingWith: ready.effects.walkTo?.withIds ?? null,
    sleepingOver: ready.effects.sleptOver === true }
}

type Update<T> = T | ((current: T) => T)
type Field = 'state' | 'scene' | 'turns' | 'ended' | 'walkingWith' | 'sleepingOver'
export type SessionAction = { [K in Field]: { type: 'set'; field: K; value: Update<GameSession[K]> } }[Field]
  | { type: 'begin'; pending: DualCheckpoint } | { type: 'cancel'; turnId: string }
  | { type: 'replacePending'; turnId: string; nextTurnId: string }
  | { type: 'rewind'; turnsBack: number }
  | { type: 'commit'; content: ContentPack; ready: DualReady } | { type: 'animationEnded' }

export function reduceGameSession(session: GameSession, action: SessionAction): GameSession {
  if (action.type === 'rewind') {
    const turn = session.turns[session.turns.length - action.turnsBack]
    if (session.pending || !Number.isInteger(action.turnsBack) || action.turnsBack < 1 || !turn) return session
    const restored = createGameSession({ state: rewound(turn, session.state), scene: turn.scene })
    return { ...restored, turns: session.turns.slice(0, -action.turnsBack), revision: session.revision + 1 }
  }
  if (action.type === 'commit') return commitDualReady(action.content, session, action.ready)
  if (action.type === 'begin') return session.pending || session.revision !== action.pending.revision ? session : { ...session, pending: action.pending }
  if (action.type === 'cancel') {
    if (session.pending?.turnId !== action.turnId) return session
    return { ...session, pending: undefined, ...(session.pending.animationEnded && session.scene && { scene: {
      ...session.scene, animationId: undefined, animationOf: undefined, animationGroup: undefined } }) }
  }
  if (action.type === 'replacePending') return session.pending?.turnId === action.turnId ? { ...session, pending: { ...session.pending, turnId: action.nextTurnId } } : session
  if (action.type === 'animationEnded') {
    // Completion of the old video cannot clear a newer pose, or invalidate the pending turn.
    if (session.pending) return { ...session, pending: { ...session.pending, animationEnded: true } }
    if (!session.scene?.animationId) return session
    return { ...session, scene: { ...session.scene, animationId: undefined, animationOf: undefined, animationGroup: undefined } }
  }
  const value = typeof action.value === 'function' ? (action.value as (current: unknown) => unknown)(session[action.field]) : action.value
  if (value === session[action.field]) return session
  if (session.pending) {
    if (action.field !== 'state') return session
    return { ...session, state: withBackground(session.state, value as GameState) }
  }
  const foreground = action.field !== 'state' || Object.keys(value as GameState).some((key) => !KEPT_ACROSS.includes(key as typeof KEPT_ACROSS[number])
    && (value as Record<string, unknown>)[key] !== (session.state as Record<string, unknown>)[key])
  return { ...session, [action.field]: value, revision: session.revision + (foreground ? 1 : 0) }
}
