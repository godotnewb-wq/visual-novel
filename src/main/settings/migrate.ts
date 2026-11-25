import { z } from 'zod'
import {
  CONNECTION_SETTINGS_VERSION,
  ConnectionProfileSchema,
  ConnectionSettingsSchema,
  type ConnectionProfile,
  type ConnectionRole
} from '../../shared/llmConnections'
import { isConfigured, LlmProfileSchema, SettingsSchema } from '../../shared/settings'

export const StoredConnectionProfileSchema = ConnectionProfileSchema.extend({
  apiKey: z.string(),
  apiKeyEncrypted: z.boolean()
})
export const StoredConnectionSettingsSchema = ConnectionSettingsSchema.safeExtend({
  profiles: z.array(StoredConnectionProfileSchema).min(1)
})
export type StoredConnectionSettings = z.infer<typeof StoredConnectionSettingsSchema>

const LegacyStoredProfileSchema = LlmProfileSchema.extend({
  apiKeyEncrypted: z.boolean().default(false)
}).strict()
const LegacyStoredSettingsSchema = SettingsSchema.extend({
  main: LegacyStoredProfileSchema.prefault({}),
  nsfw: LegacyStoredProfileSchema.prefault({})
}).strict()

export type LegacyProfileIdentities = Record<ConnectionRole, Pick<ConnectionProfile, 'id' | 'name'>>

/** Pure conversion only: the caller supplies UUIDs and localized names; startup activation belongs to F001.3. */
export function migrateConnectionSettings(raw: unknown, identities: LegacyProfileIdentities): StoredConnectionSettings {
  if (typeof raw === 'object' && raw !== null && 'settingsVersion' in raw) {
    return StoredConnectionSettingsSchema.parse(raw)
  }

  // Unknown fields must fail explicitly rather than disappear from user-authored settings.
  const legacy = LegacyStoredSettingsSchema.parse(raw)
  const defaults = LegacyStoredProfileSchema.parse({})
  const keepSecondary = Object.entries(legacy.nsfw).some(([key, value]) => value !== defaults[key as keyof typeof defaults])
  const named = (profile: z.infer<typeof LegacyStoredProfileSchema>, identity: LegacyProfileIdentities[ConnectionRole]) => ({
    ...profile,
    id: identity.id,
    name: identity.name
  })

  return StoredConnectionSettingsSchema.parse({
    settingsVersion: CONNECTION_SETTINGS_VERSION,
    profiles: [named(legacy.main, identities.main), ...(keepSecondary ? [named(legacy.nsfw, identities.nsfw)] : [])],
    assignments: {
      main: identities.main.id,
      nsfw: keepSecondary && isConfigured(legacy.nsfw) ? identities.nsfw.id : null
    },
    language: legacy.language,
    memoryRecall: legacy.memoryRecall,
    newsWebSearch: legacy.newsWebSearch
  })
}
