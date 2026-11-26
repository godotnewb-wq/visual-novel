import { describe, expect, it } from 'vitest'
import {
  DUAL_TURN_LIMITS, DualManagerEnvelopeSchema, DualNoteEntrySchema, DualNoteLedgerSchema,
  DualSceneGenerationSchema, parseDualManagerReply, type DualManagerEnvelope
} from './dualTurnContract'

const turnId = '11111111-1111-4111-8111-111111111111'
const empty = (): DualManagerEnvelope => ({ schemaVersion: 1, turnId, evidence: [], operations: [], presentation: [], comfort: [], information: [], review: [] })
const span = { id: 'e', sourceId: 'p', start: 0, end: 4, quote: 'Yes.' }
const note = (id = 'old', supersedesId: string | null = null) => ({
  id, createdTurnId: turnId, updatedTurnId: turnId, category: 'promise' as const, status: 'agreed' as const,
  subjects: [{ kind: 'player' as const }], factId: null, content: 'Bring a book.', supersedesId,
  receipts: [{ turnId, messageIndex: 0, role: 'user' as const, start: 0, end: 4, quote: 'Yes.', speaker: { kind: 'player' as const }, witnessIds: ['ana'] }]
})

describe('the dormant Manager wire contract', () => {
  it('accepts a complete no-change object with surrounding whitespace', () => {
    expect(parseDualManagerReply(` \n${JSON.stringify(empty())}\n `)).toEqual({ ok: true, value: empty() })
  })

  it.each(['[]', 'null', '1', 'true', '"text"'])('rejects a non-object root: %s', (raw) => {
    expect(parseDualManagerReply(raw)).toMatchObject({ ok: false, issues: [{ code: 'invalid-schema' }] })
  })

  it.each(['', '{', '```json\n{}\n```', 'A reply: {}', '<think>thinking</think>{}', '{} {}'])('does not extract JSON from malformed or wrapped output: %s', (raw) => {
    expect(parseDualManagerReply(raw)).toMatchObject({ ok: false, issues: [{ code: 'invalid-json' }] })
  })

  it.each(['evidence', 'operations', 'presentation', 'comfort', 'information', 'review'] as const)('requires the %s collection', (key) => {
    const raw: Partial<DualManagerEnvelope> = empty()
    delete raw[key]
    expect(DualManagerEnvelopeSchema.safeParse(raw).success).toBe(false)
  })

  it.each([
    { ...empty(), schemaVersion: 2 }, { ...empty(), turnId: 'not-a-turn' },
    { ...empty(), settings: { apiKey: 'private' } },
    { ...empty(), operations: [{ type: 'setState', evidenceIds: [], money: 999 }] },
    { ...empty(), operations: [{ type: 'endScene', evidenceIds: [], witnessIds: ['ana'] }] },
    { ...empty(), presentation: [{ type: 'reaction', actorId: 'ana', evidenceIds: [], reactionId: 'laugh', file: 'outside.ogg' }] }
  ])('rejects unsupported versions, identifiers, and fields: %#', (raw) => {
    expect(parseDualManagerReply(JSON.stringify(raw)).ok).toBe(false)
  })

  it('does not reflect raw diagnostic/private content in parse errors', () => {
    expect(JSON.stringify(parseDualManagerReply('private provider prompt {'))).not.toContain('private provider prompt')
  })

  it('counts UTF-8 bytes and includes whitespace in the reply budget', () => {
    const raw = JSON.stringify(empty())
    expect(parseDualManagerReply(raw.padEnd(DUAL_TURN_LIMITS.managerBytes)).ok).toBe(true)
    expect(parseDualManagerReply(raw.padEnd(DUAL_TURN_LIMITS.managerBytes + 1))).toMatchObject({ ok: false, issues: [{ code: 'reply-size' }] })
    const unicode = JSON.stringify({ text: 'é'.repeat(33_000) })
    expect(unicode.length).toBeLessThan(DUAL_TURN_LIMITS.managerBytes)
    expect(parseDualManagerReply(unicode)).toMatchObject({ ok: false, issues: [{ code: 'reply-size' }] })
  })

  it('requires exact evidence references and consistent offsets', () => {
    const value = empty()
    value.evidence = [span]
    value.operations = [{ type: 'endScene', evidenceIds: ['e'] }]
    expect(DualManagerEnvelopeSchema.safeParse(value).success).toBe(true)
    expect(DualManagerEnvelopeSchema.safeParse({ ...value, evidence: [span, span] }).success).toBe(false)
    expect(DualManagerEnvelopeSchema.safeParse({ ...value, evidence: [{ ...span, end: 3 }] }).success).toBe(false)
    expect(DualManagerEnvelopeSchema.safeParse({ ...value, operations: [{ type: 'endScene', evidenceIds: ['missing'] }] }).success).toBe(false)
    expect(DualManagerEnvelopeSchema.safeParse({ ...value, operations: [{ type: 'endScene', evidenceIds: ['e', 'e'] }] }).success).toBe(false)
  })

  it('keeps identifiers unaltered and bounds error lists without exposing invalid values', () => {
    const value = empty(), longId = 'custom-' + 'x'.repeat(1024)
    value.evidence = [{ ...span, id: longId }]
    value.operations = [{ type: 'endScene', evidenceIds: [longId] }]
    expect(DualManagerEnvelopeSchema.parse(value).evidence[0].id).toBe(longId)
    const invalid = { ...empty(), evidence: Array.from({ length: 48 }, (_, index) => ({ ...span, id: String(index), end: 1 })) }
    const result = parseDualManagerReply(JSON.stringify(invalid))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues).toHaveLength(DUAL_TURN_LIMITS.issues)
  })

  it('rejects a review index outside the submitted operations', () => {
    const value = { ...empty(), review: [{ code: 'missing-context', operationIndex: 0, reason: '', evidenceIds: [] }] }
    expect(DualManagerEnvelopeSchema.safeParse(value).success).toBe(false)
    expect(DualManagerEnvelopeSchema.safeParse({ ...value, review: [{ ...value.review[0], operationIndex: null }] }).success).toBe(true)
  })

  it.each([
    ['operations', Array.from({ length: 17 }, () => ({ type: 'endScene', evidenceIds: [] }))],
    ['presentation', Array.from({ length: 6 }, () => ({ type: 'pose', actorId: 'ana', animationId: null, evidenceIds: [] }))],
    ['comfort', Array.from({ length: 4 }, () => ({ actorId: 'ana', level: 3, reason: '', evidenceIds: [] }))],
    ['evidence', Array.from({ length: 49 }, (_, index) => ({ ...span, id: `e${index}` }))]
  ])('bounds the %s collection before deduplication', (key, values) => {
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), [key as string]: values }).success).toBe(false)
  })

  it.each([-1, 0.5, 13, Number.NaN, Infinity])('rejects invalid added hours %s', (hours) => {
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), operations: [{ type: 'moveScene', destinationId: 'shop', hours, stayingIds: [], stage: 'agreed', evidenceIds: [] }] }).success).toBe(false)
  })

  it.each([0, 1.5, 6])('rejects comfort outside integer levels 1–5: %s', (level) => {
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), comfort: [{ actorId: 'ana', level, reason: '', evidenceIds: [] }] }).success).toBe(false)
  })

  it('requires nullable appearance/pose members rather than silently filling them', () => {
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), presentation: [{ type: 'appearance', actorId: 'ana', evidenceIds: [] }] }).success).toBe(false)
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), presentation: [{ type: 'pose', actorId: 'ana', animationId: null, evidenceIds: [] }] }).success).toBe(true)
  })

  it('keeps evidence text byte-for-byte instead of normalizing control-like quotations', () => {
    const quote = '［EXPRESSION： happy］ {color: blue}'
    const value = { ...empty(), evidence: [{ ...span, end: quote.length, quote }] }
    const parsed = parseDualManagerReply(JSON.stringify(value))
    expect(parsed).toMatchObject({ ok: true, value: { evidence: [{ quote }] } })
  })

  it('rejects prototype-shaped unknown properties without changing object prototypes', () => {
    const raw = JSON.stringify(empty()).replace('"evidence":', '"__proto__":{"polluted":true},"evidence":')
    expect(parseDualManagerReply(raw).ok).toBe(false)
    expect(Object.hasOwn({}, 'polluted')).toBe(false)
  })

  it('enforces information action, target, and discovery relationships', () => {
    const information = { action: 'record', targetEntryId: null, category: 'fact', status: 'reported', subjects: [], factId: null, content: 'A claim.', evidenceIds: [] }
    expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), information: [information] }).success).toBe(true)
    for (const patch of [
      { targetEntryId: 'old' }, { action: 'resolve' }, { category: 'discovery' },
      { action: 'resolve', targetEntryId: 'old', status: 'agreed' }, { factId: 'secret:0' },
      { subjects: [{ kind: 'player' }, { kind: 'player' }] }, { content: ' ' }, { content: 'a'.repeat(513) }
    ]) expect(DualManagerEnvelopeSchema.safeParse({ ...empty(), information: [{ ...information, ...patch }] }).success).toBe(false)
  })
})

describe('dormant saved-note and scene metadata schemas', () => {
  it('parses a note receipt and preserves its quote, audience, and correction provenance', () => {
    expect(DualNoteEntrySchema.parse(note())).toEqual(note())
    expect(DualNoteEntrySchema.safeParse({ ...note(), witnessIds: ['outsider'] }).success).toBe(false)
    expect(DualNoteEntrySchema.safeParse({ ...note(), receipts: [{ ...note().receipts[0], end: 3 }] }).success).toBe(false)
    expect(DualNoteEntrySchema.safeParse({ ...note(), receipts: [{ ...note().receipts[0], speaker: null }] }).success).toBe(false)
    expect(DualNoteEntrySchema.safeParse({ ...note(), category: 'discovery' }).success).toBe(false)
  })

  it('allows an evicted parent but rejects self/cyclic correction links and duplicate IDs', () => {
    const ledger = { entries: [note('new', 'evicted')], trackingLimited: false, droppedCandidates: 0 }
    expect(DualNoteLedgerSchema.safeParse(ledger).success).toBe(true)
    expect(DualNoteLedgerSchema.safeParse({ ...ledger, entries: [note('a', 'a')] }).success).toBe(false)
    expect(DualNoteLedgerSchema.safeParse({ ...ledger, entries: [note('a', 'b'), note('b', 'a')] }).success).toBe(false)
    expect(DualNoteLedgerSchema.safeParse({ ...ledger, entries: [note(), note()] }).success).toBe(false)
  })

  it('enforces the note/receipt bounds and explicit tracking diagnostics', () => {
    const ledger = { entries: Array.from({ length: 128 }, (_, index) => note(`n${index}`)), trackingLimited: true, droppedCandidates: 2 }
    expect(DualNoteLedgerSchema.safeParse(ledger).success).toBe(true)
    expect(DualNoteLedgerSchema.safeParse({ ...ledger, entries: [...ledger.entries, note('overflow')] }).success).toBe(false)
    expect(DualNoteLedgerSchema.safeParse({ ...ledger, droppedCandidates: -1 }).success).toBe(false)
    expect(DualNoteEntrySchema.safeParse({ ...note(), receipts: Array(3).fill(note().receipts[0]) }).success).toBe(false)
  })

  it('round-trips every completion intent without activating SceneSchema changes', () => {
    const generation = { schemaVersion: 1, mode: 'dual', sceneId: turnId, nextTurnOrdinal: 2,
      lastCommittedTurnId: turnId, ledger: { entries: [note()], trackingLimited: false, droppedCandidates: 0 } }
    for (const completion of [{ kind: 'continue' }, { kind: 'end' }, { kind: 'sleep' }, { kind: 'walk', withIds: ['ana'] }]) {
      const saved = { ...generation, completion }
      expect(DualSceneGenerationSchema.parse(JSON.parse(JSON.stringify(saved)))).toEqual(saved)
    }
    expect(DualSceneGenerationSchema.parse({ schemaVersion: 1, mode: 'legacy' })).toEqual({ schemaVersion: 1, mode: 'legacy' })
    expect(DualSceneGenerationSchema.safeParse({ ...generation, completion: { kind: 'walk', withIds: [] } }).success).toBe(false)
    expect(DualSceneGenerationSchema.safeParse({ ...generation, completion: { kind: 'continue' }, pendingDraft: 'private' }).success).toBe(false)
  })
})
