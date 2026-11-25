import { describe, expect, it } from 'vitest'
import { ConnectionProfileSchema, ConnectionSettingsSchema } from './llmConnections'
import { LlmProfileSchema } from './settings'

const mainId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondaryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const missingId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const main = { id: mainId, name: 'Main' }
const secondary = { id: secondaryId, name: 'Secondary', baseUrl: 'http://local/v1', model: 'other' }
const settings = () => ({ settingsVersion: 2, profiles: [main, secondary], assignments: { main: mainId, nsfw: secondaryId } })

describe('connection settings model', () => {
  it('allows a first-run main profile and reuses the existing connection and global defaults', () => {
    const parsed = ConnectionSettingsSchema.parse({ settingsVersion: 2, profiles: [main], assignments: { main: mainId, nsfw: null } })
    const { apiKey: _key, ...defaults } = LlmProfileSchema.parse({})
    expect(parsed.profiles).toEqual([{ ...defaults, ...main }])
    expect(parsed).toMatchObject({ language: 'en', memoryRecall: 8, newsWebSearch: false })
  })

  it('normalizes names and UUID spelling consistently in profiles and references', () => {
    const parsed = ConnectionSettingsSchema.parse({
      settingsVersion: 2,
      profiles: [{ ...main, id: mainId.toUpperCase(), name: '  My connection  ' }],
      assignments: { main: mainId.toUpperCase(), nsfw: null }
    })
    expect(parsed.profiles[0]).toMatchObject({ id: mainId, name: 'My connection' })
    expect(parsed.assignments).toEqual({ main: mainId, nsfw: null })
  })

  it('keeps references when a profile is renamed or the collection reordered', () => {
    const renamed = ConnectionSettingsSchema.parse({ ...settings(), profiles: [{ ...secondary, name: 'Renamed' }, main] })
    expect(renamed.assignments).toEqual(settings().assignments)
  })

  it.each(['', ' ', 'not-a-uuid', 'main'])('rejects invalid profile ID %j', (id) => {
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), profiles: [{ ...main, id }, secondary] })).toThrow()
  })

  it.each(['', '  '])('rejects blank profile name %j', (name) => {
    expect(() => ConnectionProfileSchema.parse({ ...main, name })).toThrow()
  })

  it('rejects duplicate UUIDs even when their case differs', () => {
    const result = ConnectionSettingsSchema.safeParse({ ...settings(), profiles: [main, { ...secondary, id: mainId.toUpperCase() }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['profiles', 1, 'id'] }))
  })

  it('rejects duplicate names after trimming and ignoring case', () => {
    const result = ConnectionSettingsSchema.safeParse({ ...settings(), profiles: [main, { ...secondary, name: '  MAIN  ' }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['profiles', 1, 'name'] }))
  })

  it.each(['main', 'nsfw'] as const)('rejects a missing %s reference', (role) => {
    const result = ConnectionSettingsSchema.safeParse({ ...settings(), assignments: { ...settings().assignments, [role]: missingId } })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: ['assignments', role] }))
  })

  it('requires a main reference and an explicit secondary reference or null', () => {
    for (const assignments of [{ nsfw: null }, { main: null, nsfw: null }, { main: mainId }]) {
      expect(() => ConnectionSettingsSchema.parse({ ...settings(), assignments })).toThrow()
    }
  })

  it('requires a nonempty collection and the supported settings version', () => {
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), profiles: [] })).toThrow()
    for (const settingsVersion of [undefined, 1, 3]) {
      expect(() => ConnectionSettingsSchema.parse({ ...settings(), settingsVersion })).toThrow()
    }
  })

  it('rejects credential fields and unknown data rather than discarding them', () => {
    for (const extra of [{ apiKey: 'test-only-key' }, { apiKeyEncrypted: true }, { futureSampler: 1 }]) {
      expect(() => ConnectionProfileSchema.parse({ ...main, ...extra })).toThrow()
    }
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), futurePreference: true })).toThrow()
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), assignments: { ...settings().assignments, writer: mainId } })).toThrow()
  })

  it('preserves per-profile models at a shared endpoint and validates inherited parameters', () => {
    const parsed = ConnectionSettingsSchema.parse({
      ...settings(), profiles: [{ ...main, baseUrl: secondary.baseUrl, model: 'first', temperature: 0 }, { ...secondary, temperature: 2 }]
    })
    expect(parsed.profiles.map((profile) => [profile.model, profile.temperature])).toEqual([['first', 0], ['other', 2]])
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), profiles: [{ ...main, maxConcurrent: 0 }] })).toThrow()
    expect(() => ConnectionSettingsSchema.parse({ ...settings(), memoryRecall: 0 })).toThrow()
  })
})
