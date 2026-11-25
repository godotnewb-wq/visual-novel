import { describe, expect, it } from 'vitest'
import { SettingsSchema } from '../../shared/settings'
import { migrateConnectionSettings, StoredConnectionSettingsSchema, type LegacyProfileIdentities } from './migrate'

const identities: LegacyProfileIdentities = {
  main: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Main LLM' },
  nsfw: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'NSFW LLM' }
}
const connection = {
  baseUrl: 'http://local/v1/', apiKey: 'test-only-key', model: 'test-model', temperature: 0,
  maxTokens: 4096, timeoutSeconds: 300, instructions: 'Test instructions', reasoning: 'off', reasoningStyle: 'template',
  topP: 0, minP: 0.05, topK: 0, repetitionPenalty: 1.2, frequencyPenalty: -2, presencePenalty: 2,
  providerOrder: 'Provider A, Provider B', providerIgnore: 'Provider C', allowFallbacks: false, maxConcurrent: 2
}

describe('connection settings conversion', () => {
  it('creates an unconfigured main profile for empty first-run settings', () => {
    const result = migrateConnectionSettings({}, identities)
    expect(result.settingsVersion).toBe(2)
    expect(result.profiles).toEqual([{ ...SettingsSchema.parse({}).main, ...identities.main, apiKeyEncrypted: false }])
    expect(result.assignments).toEqual({ main: identities.main.id, nsfw: null })
    expect(result).toMatchObject({ language: 'en', memoryRecall: 8, newsWebSearch: false })
  })

  it('preserves every main parameter, plaintext credential, and global preference', () => {
    const input = { main: connection, language: 'zh-CN', memoryRecall: 20, newsWebSearch: true }
    const result = migrateConnectionSettings(input, identities)
    expect(result.profiles).toEqual([{ ...connection, ...identities.main, apiKeyEncrypted: false }])
    expect(result).toMatchObject({ language: 'zh-CN', memoryRecall: 20, newsWebSearch: true })
    expect(result.assignments.nsfw).toBeNull()
  })

  it('preserves both profiles independently and assigns a configured secondary', () => {
    const second = { ...connection, apiKey: 'other-test-key', model: 'second', temperature: 1.5, topK: 50 }
    const result = migrateConnectionSettings({ main: connection, nsfw: second }, identities)
    expect(result.profiles).toEqual([
      { ...connection, ...identities.main, apiKeyEncrypted: false },
      { ...second, ...identities.nsfw, apiKeyEncrypted: false }
    ])
    expect(result.assignments).toEqual({ main: identities.main.id, nsfw: identities.nsfw.id })
  })

  it('retains encrypted bytes and their flags without needing a cipher', () => {
    const main = { ...connection, apiKey: 'opaque-main-ciphertext', apiKeyEncrypted: true }
    const nsfw = { ...connection, apiKey: 'opaque-secondary-ciphertext', apiKeyEncrypted: true }
    const result = migrateConnectionSettings({ main, nsfw }, identities)
    expect(result.profiles).toEqual([{ ...main, ...identities.main }, { ...nsfw, ...identities.nsfw }])
  })

  it.each([
    { baseUrl: 'http://unfinished/v1' },
    { model: 'draft-model' },
    { apiKey: 'draft-test-key' },
    { apiKey: 'opaque-ciphertext', apiKeyEncrypted: true },
    { instructions: 'Draft instructions' },
    { temperature: 0 },
    { topP: 0, topK: 0 },
    { providerOrder: 'Provider A', allowFallbacks: false },
    { baseUrl: '  ', model: '  ' }
  ])('retains but does not activate an incomplete secondary %j', (nsfw) => {
    const result = migrateConnectionSettings({ nsfw }, identities)
    expect(result.profiles).toHaveLength(2)
    expect(result.profiles[1]).toMatchObject({ ...identities.nsfw, ...nsfw })
    expect(result.assignments.nsfw).toBeNull()
  })

  it('does not manufacture a secondary profile from unchanged defaults', () => {
    expect(migrateConnectionSettings(SettingsSchema.parse({}), identities).profiles).toHaveLength(1)
  })

  it('requires no API key for a configured local secondary', () => {
    const result = migrateConnectionSettings({ nsfw: { baseUrl: 'http://local/v1', model: 'local' } }, identities)
    expect(result.profiles[1].apiKey).toBe('')
    expect(result.assignments.nsfw).toBe(identities.nsfw.id)
  })

  it('is stable after JSON reload and does not replace existing IDs or renamed profiles', () => {
    const converted = migrateConnectionSettings({ main: connection, nsfw: connection }, identities)
    converted.profiles[0].name = 'Renamed'
    const otherIdentities: LegacyProfileIdentities = {
      main: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Other main' },
      nsfw: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', name: 'Other secondary' }
    }
    expect(migrateConnectionSettings(JSON.parse(JSON.stringify(converted)), otherIdentities)).toEqual(converted)
  })

  it('does not mutate inputs or share profile objects with them', () => {
    const main = Object.freeze({ ...connection })
    const input = Object.freeze({ main })
    const supplied = Object.freeze({ main: Object.freeze({ ...identities.main }), nsfw: Object.freeze({ ...identities.nsfw }) })
    const before = JSON.stringify({ input, supplied })
    const result = migrateConnectionSettings(input, supplied)
    result.profiles[0].model = 'Changed output'
    expect(JSON.stringify({ input, supplied })).toBe(before)
  })

  it.each([
    null, [], 'not settings',
    { main: { temperature: 3 } },
    { nsfw: { apiKeyEncrypted: 'yes' } },
    { main: { apiKey: 123 } },
    { main: { unknownSampler: 1 } },
    { unknownPreference: true },
    { settingsVersion: 1 },
    { settingsVersion: 3 }
  ])('rejects malformed or unrecognized input without changing it: %j', (input) => {
    const before = JSON.stringify(input)
    expect(() => migrateConnectionSettings(input, identities)).toThrow()
    expect(JSON.stringify(input)).toBe(before)
  })

  it('validates generated identities and rejects collisions rather than changing references', () => {
    for (const main of [{ ...identities.main, id: 'main' }, { ...identities.main, name: '  ' }]) {
      expect(() => migrateConnectionSettings({}, { ...identities, main })).toThrow()
    }
    expect(() => migrateConnectionSettings({ nsfw: connection }, { ...identities, nsfw: { ...identities.nsfw, id: identities.main.id } })).toThrow()
    expect(() => migrateConnectionSettings({ nsfw: connection }, { ...identities, nsfw: { ...identities.nsfw, name: ' main llm ' } })).toThrow()
  })

  it('enforces reference and uniqueness checks on stored version-2 settings too', () => {
    const converted = migrateConnectionSettings({ main: connection, nsfw: connection }, identities)
    expect(() => StoredConnectionSettingsSchema.parse({ ...converted, assignments: { ...converted.assignments, main: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' } })).toThrow()
    expect(() => migrateConnectionSettings({ ...converted, profiles: [converted.profiles[0], { ...converted.profiles[1], name: ' MAIN LLM ' }] }, identities)).toThrow()
    expect(() => migrateConnectionSettings({ ...converted, profiles: [converted.profiles[0], { ...converted.profiles[1], id: identities.main.id }] }, identities)).toThrow()
  })
})
