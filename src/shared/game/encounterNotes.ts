import type { ContentPack, Scene } from '../model'
import { factsOf } from './facts'
import { sceneCast } from './scene'
import { DUAL_TURN_LIMITS, type DualNoteEntry } from './dualTurnContract'
import type { DualNoteChange } from './dualTurnEffects'

export const NOTE_VIEW_LIMITS = { characterNotes: 8, characterCharacters: 4096, managerNotes: 12, managerCharacters: 12_000 } as const
export function initialiseSceneGeneration(scene: Scene, mode: 'legacy' | 'dual', sceneId: string): Scene {
  if (scene.generation) return scene
  return { ...scene, generation: mode === 'legacy' ? { schemaVersion: 1, mode } : { schemaVersion: 1, mode, sceneId,
    nextTurnOrdinal: 1, lastCommittedTurnId: null, completion: { kind: 'continue' }, comfortHistory: {}, turnHistory: [],
    beatWitnesses: scene.beats.map((_beat, beatIndex) => ({ beatIndex, witnessIds: sceneCast(scene) })).slice(0, 128),
    witnesses: sceneCast(scene).map((actorId) => ({ actorId, fromMessage: 0, toMessage: null })),
    ledger: { entries: [], trackingLimited: false, droppedCandidates: 0 } } }
}

export function stageWitnesses(scene: Scene, fromMessage: number, firstNewBeat = scene.beats.length): Scene {
  if (scene.generation?.mode !== 'dual') return scene
  const witnesses = [...(scene.generation.witnesses ?? [])]
  let limited = false
  for (const actorId of sceneCast(scene)) {
    if (witnesses.some((range) => range.actorId === actorId && range.toMessage === null)) continue
    if (witnesses.length >= 128) { limited = true; continue }
    witnesses.push({ actorId, fromMessage, toMessage: null })
  }
  const beatWitnesses = [...(scene.generation.beatWitnesses ?? [])]
  for (let beatIndex = firstNewBeat; beatIndex < scene.beats.length; beatIndex++) {
    if (beatWitnesses.some((record) => record.beatIndex === beatIndex)) continue
    if (beatWitnesses.length >= 128) { limited = true; continue }
    beatWitnesses.push({ beatIndex, witnessIds: sceneCast(scene) })
  }
  return { ...scene, generation: { ...scene.generation, witnesses, beatWitnesses, ledger: { ...scene.generation.ledger,
    trackingLimited: scene.generation.ledger.trackingLimited || limited } } }
}
const audience = (entry: DualNoteEntry) => entry.receipts[0].witnessIds.filter((id) => entry.receipts.every((receipt) => receipt.witnessIds.includes(id)))
const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
const subjects = (entry: DualNoteEntry) => entry.subjects.map((actor) => actor.kind === 'player' ? 'player' : `character:${actor.id}`).sort().join('|')
const sameClaim = (one: DualNoteEntry, two: DualNoteEntry) => one.category === two.category && one.status === two.status
  && one.factId === two.factId && subjects(one) === subjects(two) && normalized(one.content) === normalized(two.content)

export function visibleNoteVersions(entries: readonly DualNoteEntry[], actorId: string): DualNoteEntry[] {
  const all = new Map(entries.map((entry) => [entry.id, entry]))
  const visible = entries.filter((entry) => entry.receipts.every((receipt) => receipt.witnessIds.includes(actorId)))
  const replaced = new Set<string>()
  for (const entry of visible) {
    let parent = entry.supersedesId
    const visited = new Set<string>()
    while (parent !== null && !visited.has(parent)) {
      visited.add(parent); replaced.add(parent)
      parent = all.get(parent)?.supersedesId ?? null
    }
  }
  return visible.filter((entry) => !replaced.has(entry.id))
}

function validSubjects(content: ContentPack, entry: DualNoteEntry) {
  if (entry.subjects.some((actor) => actor.kind === 'character' && ![...content.loveInterests, ...content.npcs].some((person) => person.id === actor.id))) return false
  if (entry.category !== 'discovery') return true
  const actor = entry.subjects.length === 1 ? entry.subjects[0] : undefined
  const person = actor?.kind === 'character' ? content.loveInterests.find((person) => person.id === actor.id) : undefined
  return !!person && factsOf(content, person).some((fact) => fact.id === entry.factId)
}

export function witnessedAt(scene: Scene, messageIndex: number): string[] {
  if (scene.generation?.mode !== 'dual') return []
  return [...new Set((scene.generation.witnesses ?? []).filter((range) => range.fromMessage <= messageIndex
    && (range.toMessage === null || messageIndex < range.toMessage)).map((range) => range.actorId))]
}

function bounded(entries: DualNoteEntry[], count: number, characters: number): DualNoteEntry[] {
  const priority = (entry: DualNoteEntry) => ['promise', 'plan'].includes(entry.category) && !['completed', 'withdrawn'].includes(entry.status) ? 0 : 1
  const ordered = entries.map((entry, index) => ({ entry, index })).sort((one, two) => priority(one.entry) - priority(two.entry) || two.index - one.index)
  const selected: DualNoteEntry[] = []
  let used = 0
  for (const { entry } of ordered) {
    const size = JSON.stringify(entry).length
    if (selected.length >= count) break
    if (used + size > characters) continue
    selected.push(entry); used += size
  }
  return selected
}

export function characterNotes(content: ContentPack, scene: Scene, actorId: string): DualNoteEntry[] {
  if (scene.npc || scene.generation?.mode !== 'dual') return []
  return bounded(visibleNoteVersions(scene.generation.ledger.entries, actorId).filter((entry) => validSubjects(content, entry)),
    NOTE_VIEW_LIMITS.characterNotes, NOTE_VIEW_LIMITS.characterCharacters)
}

export function managerNoteTargets(content: ContentPack, scene: Scene): DualNoteEntry[] {
  if (scene.npc || scene.generation?.mode !== 'dual') return []
  const visible = new Set(sceneCast(scene).flatMap((id) => visibleNoteVersions(scene.generation!.mode === 'dual' ? scene.generation!.ledger.entries : [], id).map((entry) => entry.id)))
  return bounded(scene.generation.ledger.entries.filter((entry) => visible.has(entry.id) && validSubjects(content, entry)), NOTE_VIEW_LIMITS.managerNotes, NOTE_VIEW_LIMITS.managerCharacters)
}

function withoutEntry(entries: readonly DualNoteEntry[], removed: DualNoteEntry): DualNoteEntry[] {
  return entries.filter((entry) => entry.id !== removed.id).map((entry) => entry.supersedesId === removed.id ? { ...entry, supersedesId: removed.supersedesId } : entry)
}

function safelyRemove(entries: readonly DualNoteEntry[], removed: DualNoteEntry) {
  const next = withoutEntry(entries, removed)
  const actors = new Set(entries.flatMap(audience))
  for (const actor of actors) {
    const before = new Set(visibleNoteVersions(entries, actor).map((entry) => entry.id))
    if (visibleNoteVersions(next, actor).some((entry) => !before.has(entry.id))) return null
  }
  return next
}

export function reconcileEncounterNotes(scene: Scene, changes: readonly DualNoteChange[]): Scene {
  if (scene.generation?.mode !== 'dual') return scene
  const ledger = scene.generation.ledger
  let entries = [...ledger.entries], dropped = 0
  for (const change of changes) {
    const target = entries.find((entry) => entry.id === change.targetEntryId)
    if (change.action !== 'record' && !target) { dropped++; continue }
    const entry = { ...change.entry, supersedesId: change.action === 'record' ? null : change.targetEntryId }
    if (entries.some((old) => old.id === entry.id || sameClaim(old, entry) && JSON.stringify(old.receipts) === JSON.stringify(entry.receipts))) continue
    // Repeated optional claims from the same speakers/audience need not consume another slot; commitments retain event identity.
    if (change.action === 'record' && !['promise', 'plan'].includes(entry.category) && entries.some((old) => sameClaim(old, entry)
      && JSON.stringify(audience(old).sort()) === JSON.stringify(audience(entry).sort())
      && JSON.stringify(old.receipts.map((receipt) => [receipt.role, receipt.speaker, receipt.quote])) === JSON.stringify(entry.receipts.map((receipt) => [receipt.role, receipt.speaker, receipt.quote])))) continue
    entries.push(entry)
    if (entries.length <= DUAL_TURN_LIMITS.notes) continue
    const rank = (candidate: DualNoteEntry) => {
      const viewers = audience(candidate)
      const fullyReplaced = viewers.length > 0 && viewers.every((id) => !visibleNoteVersions(entries, id).some((visible) => visible.id === candidate.id))
      return fullyReplaced ? 0 : ['completed', 'withdrawn'].includes(candidate.status) ? 1 : ['promise', 'plan'].includes(candidate.category) ? 3 : 2
    }
    const candidates = entries.filter((candidate) => candidate.id !== entry.id).map((candidate, index) => ({ candidate, index, rank: rank(candidate) }))
      .filter((candidate) => candidate.rank < 3).sort((one, two) => one.rank - two.rank || one.index - two.index)
    let next: DualNoteEntry[] | null = null
    for (const candidate of candidates) { next = safelyRemove(entries, candidate.candidate); if (next) break }
    if (next) entries = next
    else { entries = entries.filter((candidate) => candidate.id !== entry.id); dropped++ }
  }
  return { ...scene, generation: { ...scene.generation, ledger: { entries, trackingLimited: ledger.trackingLimited || dropped > 0,
    droppedCandidates: Math.min(Number.MAX_SAFE_INTEGER, ledger.droppedCandidates + dropped) } } }
}
