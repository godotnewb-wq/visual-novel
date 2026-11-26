import { z } from 'zod'
import { GENERATION_SETTINGS_VERSION, GenerationSettingsSchema } from '../../shared/generationConnections'
import { migrateConnectionSettings, StoredConnectionProfileSchema, StoredConnectionSettingsSchema, type LegacyProfileIdentities, type StoredConnectionSettings } from './migrate'

export const StoredGenerationSettingsSchema = GenerationSettingsSchema.safeExtend({ profiles: z.array(StoredConnectionProfileSchema).min(1) })
export type StoredGenerationSettings = z.infer<typeof StoredGenerationSettingsSchema>

export function generationLegacyView(settings: StoredGenerationSettings): StoredConnectionSettings {
  const { generationMode: _mode, assignments, ...rest } = settings
  return StoredConnectionSettingsSchema.parse({ ...rest, settingsVersion: 2, assignments: { main: assignments.main, nsfw: assignments.nsfw } })
}

/** Conversion is pure; the opt-in store owns exact backups and the atomic replacement. */
export function migrateGenerationSettings(raw: unknown, identities?: LegacyProfileIdentities): StoredGenerationSettings {
  if (typeof raw === 'object' && raw !== null && 'settingsVersion' in raw) {
    if (raw.settingsVersion === GENERATION_SETTINGS_VERSION) return StoredGenerationSettingsSchema.parse(raw)
    const previous = StoredConnectionSettingsSchema.parse(raw)
    return StoredGenerationSettingsSchema.parse({ ...previous, settingsVersion: GENERATION_SETTINGS_VERSION,
      generationMode: 'legacy', assignments: { ...previous.assignments, writer: null, manager: null } })
  }
  if (!identities) throw new Error('Legacy conversion requires supplied profile identities.')
  return migrateGenerationSettings(migrateConnectionSettings(raw, identities))
}
