import { z } from 'zod'
import { MAX_SCENE_CAST } from '../model/appointment'

export const DUAL_TURN_LIMITS = {
  managerBytes: 65_536, writerCharacters: 12_000, writerBeats: 32,
  evidence: 48, evidenceReferences: 4, operations: 16, presentation: 5,
  information: 8, review: 8, quote: 512, content: 512, reason: 160,
  activity: 160, notes: 128, receipts: 2, issues: 32
} as const

const id = z.string().min(1)
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const nonblank = (limit: number) => z.string().min(1).max(limit).refine((value) => value.trim().length > 0)
const distinctIds = (max: number, min = 0) => z.array(id).min(min).max(max).refine((ids) => new Set(ids).size === ids.length)
const evidenceIds = distinctIds(DUAL_TURN_LIMITS.evidenceReferences)
const supported = { evidenceIds }
const stage = z.enum(['invited', 'agreed', 'completed'])
const category = z.enum(['fact', 'preference', 'promise', 'plan', 'discovery', 'openTopic'])
const informationStatus = z.enum(['reported', 'proposed', 'agreed', 'completed', 'withdrawn'])

export const DualActorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('player') }).strict(),
  z.object({ kind: z.literal('character'), id }).strict()
])
export type DualActor = z.infer<typeof DualActorSchema>
const actors = z.array(DualActorSchema).max(MAX_SCENE_CAST + 1).refine((values) =>
  new Set(values.map((actor) => actor.kind === 'player' ? 'player' : `character:${actor.id}`)).size === values.length)

export const DualEvidenceSchema = z.object({
  id, sourceId: id, start: integer, end: integer,
  quote: z.string().min(1).max(DUAL_TURN_LIMITS.quote)
}).strict().refine((span) => span.end > span.start && span.end - span.start === span.quote.length)
export type DualEvidence = z.infer<typeof DualEvidenceSchema>

export const DualMeetingRequestSchema = z.object({
  actorId: id, activity: nonblank(DUAL_TURN_LIMITS.activity), placeId: id,
  companionIds: distinctIds(MAX_SCENE_CAST - 1),
  earliest: z.enum(['today', 'tomorrow', 'later this week', 'the weekend', 'next week']).nullable(),
  weekday: id.nullable(), timeOfDay: id.nullable()
}).strict()
export type DualMeetingRequest = z.infer<typeof DualMeetingRequestSchema>

export const DualOperationSchema = z.discriminatedUnion('type', [
  z.object({ ...supported, type: z.literal('moveScene'), destinationId: id,
    hours: z.number().int().min(0).max(12), stayingIds: distinctIds(MAX_SCENE_CAST - 1), stage }).strict(),
  z.object({ ...supported, type: z.literal('walkToEvent'), optionId: id, stage }).strict(),
  z.object({ ...supported, type: z.literal('proposeMeeting'), offerId: id.nullable(), request: DualMeetingRequestSchema }).strict(),
  z.object({ ...supported, type: z.literal('acceptMeeting'), proposalRef: id }).strict(),
  z.object({ ...supported, type: z.literal('proposeBond'), statusId: id, memberIds: distinctIds(MAX_SCENE_CAST, 1) }).strict(),
  z.object({ ...supported, type: z.literal('leaveScene'), actorIds: distinctIds(MAX_SCENE_CAST, 1),
    feeling: z.enum(['content', 'hurt', 'angry']), reason: z.string().max(DUAL_TURN_LIMITS.reason) }).strict(),
  z.object({ ...supported, type: z.literal('attendEvent'), eventId: id, actorIds: distinctIds(MAX_SCENE_CAST, 1) }).strict(),
  z.object({ ...supported, type: z.literal('sleepOver'), stage }).strict(),
  z.object({ ...supported, type: z.literal('endScene') }).strict(),
  z.object({ ...supported, type: z.literal('stopBirthControl'), actorId: id }).strict(),
  z.object({ ...supported, type: z.literal('potentialConception'), actorId: id }).strict()
])
export type DualOperation = z.infer<typeof DualOperationSchema>

export const DualPresentationSchema = z.discriminatedUnion('type', [
  z.object({ ...supported, type: z.literal('appearance'), actorId: id, outfitId: id.nullable(), expression: id.nullable() }).strict(),
  z.object({ ...supported, type: z.literal('pose'), actorId: id, animationId: id.nullable() }).strict(),
  z.object({ ...supported, type: z.literal('reaction'), actorId: id, reactionId: id }).strict()
])
export type DualPresentation = z.infer<typeof DualPresentationSchema>
export const DualComfortSchema = z.object({ ...supported, actorId: id,
  level: z.number().int().min(1).max(5), reason: z.string().max(DUAL_TURN_LIMITS.reason) }).strict()
export type DualComfort = z.infer<typeof DualComfortSchema>

export const DualInformationSchema = z.object({
  ...supported, action: z.enum(['record', 'supersede', 'resolve']), targetEntryId: id.nullable(),
  category, status: informationStatus, subjects: actors, factId: id.nullable(), content: nonblank(DUAL_TURN_LIMITS.content)
}).strict().superRefine((value, context) => {
  if ((value.action === 'record') !== (value.targetEntryId === null)) {
    context.addIssue({ code: 'custom', path: ['targetEntryId'], message: 'The target must match the information action.' })
  }
  if (value.action === 'resolve' && value.status !== 'completed' && value.status !== 'withdrawn') {
    context.addIssue({ code: 'custom', path: ['status'], message: 'Resolution must complete or withdraw an entry.' })
  }
  if ((value.category === 'discovery') !== (value.factId !== null)) {
    context.addIssue({ code: 'custom', path: ['factId'], message: 'A discovery needs a fact ID.' })
  }
})
export type DualInformation = z.infer<typeof DualInformationSchema>

export const DualReviewSchema = z.object({
  ...supported, code: z.enum(['ambiguous-action', 'prose-state-conflict', 'missing-context']),
  operationIndex: integer.nullable(), reason: z.string().max(DUAL_TURN_LIMITS.reason)
}).strict()

export const DualManagerEnvelopeSchema = z.object({
  schemaVersion: z.literal(1), turnId: z.uuid(),
  evidence: z.array(DualEvidenceSchema).max(DUAL_TURN_LIMITS.evidence),
  operations: z.array(DualOperationSchema).max(DUAL_TURN_LIMITS.operations),
  presentation: z.array(DualPresentationSchema).max(DUAL_TURN_LIMITS.presentation),
  comfort: z.array(DualComfortSchema).max(MAX_SCENE_CAST),
  information: z.array(DualInformationSchema).max(DUAL_TURN_LIMITS.information),
  review: z.array(DualReviewSchema).max(DUAL_TURN_LIMITS.review)
}).strict().superRefine((value, context) => {
  const ids = new Set(value.evidence.map((span) => span.id))
  if (ids.size !== value.evidence.length) context.addIssue({ code: 'custom', path: ['evidence'], message: 'Evidence IDs must be unique.' })
  for (const collection of ['operations', 'presentation', 'comfort', 'information', 'review'] as const) {
    value[collection].forEach((item, index) => {
      if (item.evidenceIds.some((reference) => !ids.has(reference))) {
        context.addIssue({ code: 'custom', path: [collection, index, 'evidenceIds'], message: 'Unknown evidence reference.' })
      }
    })
  }
  value.review.forEach((item, index) => {
    if (item.operationIndex !== null && item.operationIndex >= value.operations.length) {
      context.addIssue({ code: 'custom', path: ['review', index, 'operationIndex'], message: 'Unknown operation index.' })
    }
  })
})
export type DualManagerEnvelope = z.infer<typeof DualManagerEnvelopeSchema>

export const DualReceiptSchema = z.object({
  turnId: z.uuid(), messageIndex: integer, role: z.enum(['user', 'assistant']), start: integer, end: integer,
  quote: z.string().min(1).max(DUAL_TURN_LIMITS.quote), speaker: DualActorSchema.nullable(), witnessIds: distinctIds(MAX_SCENE_CAST)
}).strict().refine((receipt) => receipt.end > receipt.start && receipt.end - receipt.start === receipt.quote.length)
  .refine((receipt) => receipt.role === 'user' ? receipt.speaker?.kind === 'player' : receipt.speaker?.kind !== 'player')
export const DualNoteEntrySchema = z.object({
  id, createdTurnId: z.uuid(), updatedTurnId: z.uuid(), category, status: informationStatus,
  turnOrdinal: integer.optional(), gameTime: integer.optional(),
  subjects: actors, factId: id.nullable(), content: nonblank(DUAL_TURN_LIMITS.content),
  receipts: z.array(DualReceiptSchema).min(1).max(DUAL_TURN_LIMITS.receipts), supersedesId: id.nullable()
}).strict().refine((entry) => entry.supersedesId !== entry.id)
  .refine((entry) => (entry.category === 'discovery') === (entry.factId !== null))
export type DualNoteEntry = z.infer<typeof DualNoteEntrySchema>
export const DualNoteLedgerSchema = z.object({
  entries: z.array(DualNoteEntrySchema).max(DUAL_TURN_LIMITS.notes), trackingLimited: z.boolean(), droppedCandidates: integer
}).strict().superRefine((ledger, context) => {
  const entries = new Map(ledger.entries.map((entry) => [entry.id, entry]))
  if (entries.size !== ledger.entries.length) context.addIssue({ code: 'custom', path: ['entries'], message: 'Note IDs must be unique.' })
  for (const entry of ledger.entries) {
    const visited = new Set<string>()
    let current: DualNoteEntry | undefined = entry
    while (current) {
      if (visited.has(current.id)) {
        context.addIssue({ code: 'custom', path: ['entries'], message: 'Note corrections cannot form a cycle.' })
        return
      }
      visited.add(current.id)
      current = current.supersedesId === null ? undefined : entries.get(current.supersedesId)
    }
  }
})
export const DualCompletionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('continue') }).strict(), z.object({ kind: z.literal('end') }).strict(),
  z.object({ kind: z.literal('sleep') }).strict(),
  z.object({ kind: z.literal('walk'), withIds: distinctIds(MAX_SCENE_CAST, 1) }).strict()
])
// Optional on scenes so earlier saves retain their original Legacy behavior.
export const DualSceneGenerationSchema = z.discriminatedUnion('mode', [
  z.object({ schemaVersion: z.literal(1), mode: z.literal('legacy') }).strict(),
  z.object({ schemaVersion: z.literal(1), mode: z.literal('dual'), sceneId: z.uuid(),
    nextTurnOrdinal: integer.min(1), lastCommittedTurnId: z.uuid().nullable(),
    witnesses: z.array(z.object({ actorId: id, fromMessage: integer, toMessage: integer.nullable() }).strict()
      .refine((range) => range.toMessage === null || range.toMessage >= range.fromMessage)).max(128).optional(),
    beatWitnesses: z.array(z.object({ beatIndex: integer, witnessIds: distinctIds(MAX_SCENE_CAST) }).strict()).max(128).optional(),
    turnHistory: z.array(z.object({ turnId: z.uuid(), fromMessage: integer, toMessage: integer }).strict()
      .refine((range) => range.toMessage > range.fromMessage)).max(128).optional(),
    comfortHistory: z.record(id, z.array(z.object({ level: z.number().int().min(1).max(5), reason: z.string().max(DUAL_TURN_LIMITS.reason) }).strict()).max(2)).optional(),
    ledger: DualNoteLedgerSchema, completion: DualCompletionSchema }).strict()
])

export type DualIssueCode = 'reply-size' | 'invalid-json' | 'invalid-schema' | 'stale-turn' | 'context'
  | 'evidence-source' | 'evidence-span' | 'evidence-current' | 'evidence-attribution' | 'agency'
  | 'actor' | 'subject' | 'game-rule' | 'asset' | 'conflict' | 'information-target' | 'information-fact'
  | 'review' | 'writer-empty' | 'writer-size' | 'writer-control'
export interface DualIssue { code: DualIssueCode; path: (string | number)[] }
export type DualCheck<T> = { ok: true; value: T } | { ok: false; issues: DualIssue[] }

export function parseDualManagerReply(written: string): DualCheck<DualManagerEnvelope> {
  if (written.length > DUAL_TURN_LIMITS.managerBytes || new TextEncoder().encode(written).byteLength > DUAL_TURN_LIMITS.managerBytes) {
    return { ok: false, issues: [{ code: 'reply-size', path: [] }] }
  }
  let raw: unknown
  try { raw = JSON.parse(written.trim()) } catch { return { ok: false, issues: [{ code: 'invalid-json', path: [] }] } }
  const parsed = DualManagerEnvelopeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, issues: parsed.error.issues.slice(0, DUAL_TURN_LIMITS.issues).map((issue) => ({
    code: 'invalid-schema', path: issue.path.map((part) => typeof part === 'number' ? part : String(part))
  })) }
  return { ok: true, value: parsed.data }
}
