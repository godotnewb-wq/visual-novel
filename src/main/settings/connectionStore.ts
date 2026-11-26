import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import { z } from 'zod'
import {
  AssignConnectionSchema, ConnectionProfileIdSchema, ConnectionSettingsViewSchema, CreateConnectionSchema,
  DeleteConnectionSchema, DuplicateConnectionSchema, RenameConnectionSchema, UpdateConnectionPreferencesSchema,
  UpdateConnectionSchema, SaveConnectionRolesSchema, type ConnectionErrorCode, type ConnectionRole, type ConnectionSettingsView
} from '../../shared/llmConnections'
import { t } from '../../shared/i18n'
import { LlmProfileSchema, type LlmProfile } from '../../shared/settings'
import { sameConnectionEndpoint } from '../../shared/connectionEndpoint'
import type { CapturedConnection, ConnectionSnapshot } from './requestSnapshot'
import { ConnectionStoreError } from './connectionErrors'
import { writeConnectionFile, writeExclusive, type ConnectionFiles } from './connectionFiles'
import { migrateConnectionSettings, StoredConnectionSettingsSchema, type StoredConnectionSettings } from './migrate'
import { AssignGenerationConnectionSchema, GENERATION_SETTINGS_VERSION, GenerationSettingsViewSchema, SetGenerationModeSchema, type GenerationSettingsView } from '../../shared/generationConnections'
import { generationLegacyView, migrateGenerationSettings, StoredGenerationSettingsSchema } from './generationMigrate'
import type { GenerationSnapshot } from './requestSnapshot'
import type { KeyCipher } from './store'

interface ConnectionStoreOptions {
  /** The application opts into v3; older callers can still explicitly use the v2 store. */
  generation?: boolean
  cipher?: KeyCipher
  names?: Record<ConnectionRole, string>
  makeId?: () => string
  files?: ConnectionFiles
}

function validate<S extends z.ZodType>(schema: S, raw: unknown, code: ConnectionErrorCode = 'invalid-request'): z.output<S> {
  const result = schema.safeParse(raw)
  if (!result.success) throw new ConnectionStoreError(code)
  return result.data
}

/** The sole settings writer, with an exact backup before conversion and a v2 compatibility view. */
export class ConnectionStore {
  private settings: StoredConnectionSettings
  private fileContents: Buffer | undefined
  private readonly files: ConnectionFiles
  private readonly makeId: () => string
  private readonly cipher: KeyCipher | undefined
  readonly migrationBackupPath: string | undefined
  private generation: { generationMode: 'legacy' | 'dual'; writer: string | null; manager: string | null } | null = null

  constructor(private readonly path: string, options: ConnectionStoreOptions = {}) {
    this.files = options.files ?? fs
    this.makeId = options.makeId ?? randomUUID
    this.cipher = options.cipher
    this.fileContents = this.read()
    let raw: unknown = {}
    if (this.fileContents !== undefined) {
      try { raw = JSON.parse(this.fileContents.toString('utf8')) } catch { throw new ConnectionStoreError('invalid-settings') }
    }
    if (!options.generation && typeof raw === 'object' && raw !== null && 'settingsVersion' in raw) {
      this.settings = validate(StoredConnectionSettingsSchema, raw, 'invalid-settings')
      return
    }

    const names = options.names ?? { main: t('shell.settings.mainTitle'), nsfw: t('shell.settings.nsfwTitle') }
    let converted: StoredConnectionSettings
    try {
      const versioned = typeof raw === 'object' && raw !== null && 'settingsVersion' in raw
      const identities = versioned ? undefined : {
        main: { id: this.makeId(), name: names.main }, nsfw: { id: this.makeId(), name: names.nsfw }
      }
      if (options.generation) {
        const next = migrateGenerationSettings(raw, identities)
        this.generation = { generationMode: next.generationMode, writer: next.assignments.writer, manager: next.assignments.manager }
        converted = generationLegacyView(next)
        if (typeof raw === 'object' && raw !== null && 'settingsVersion' in raw && raw.settingsVersion === GENERATION_SETTINGS_VERSION) {
          this.settings = converted
          return
        }
      } else converted = migrateConnectionSettings(raw, identities!)
    } catch { throw new ConnectionStoreError('invalid-settings') }
    converted = this.protectKeys(converted)
    if (this.fileContents !== undefined) {
      this.migrationBackupPath = `${this.path}.pre-v${this.generation ? GENERATION_SETTINGS_VERSION : 2}-${randomUUID()}.bak`
      this.assertUnchanged()
      try { writeExclusive(this.migrationBackupPath, this.fileContents, this.files) } catch { throw new ConnectionStoreError('backup-failed') }
    }
    this.settings = this.persist(converted)
  }

  getView(): ConnectionSettingsView {
    const profiles = this.settings.profiles.map(({ apiKey, apiKeyEncrypted: _encrypted, ...profile }) => ({
      ...profile, hasApiKey: apiKey.length > 0
    }))
    return ConnectionSettingsViewSchema.parse({ ...this.settings, profiles, encryptionAvailable: this.cipher !== undefined })
  }

  /** Decrypt only for the privileged caller taking a request snapshot, never for a renderer view. */
  getProfile(rawId: unknown): LlmProfile {
    const profile = this.profile(validate(ConnectionProfileIdSchema, rawId))
    return this.resolveProfile(profile)
  }

  snapshot(): ConnectionSnapshot {
    return Object.freeze({
      main: this.capture(this.settings.assignments.main),
      nsfw: this.settings.assignments.nsfw === null ? null : this.capture(this.settings.assignments.nsfw),
      language: this.settings.language, memoryRecall: this.settings.memoryRecall, newsWebSearch: this.settings.newsWebSearch,
      languageInstruction: t('core.llm.writeIn')
    })
  }

  getGenerationView(): GenerationSettingsView {
    if (!this.generation) throw new ConnectionStoreError('invalid-request')
    const view = this.getView()
    return GenerationSettingsViewSchema.parse({ ...view, settingsVersion: GENERATION_SETTINGS_VERSION,
      generationMode: this.generation.generationMode,
      assignments: { ...view.assignments, writer: this.generation.writer, manager: this.generation.manager } })
  }

  assignGeneration(raw: unknown): GenerationSettingsView {
    if (!this.generation) throw new ConnectionStoreError('invalid-request')
    const { role, profileId } = validate(AssignGenerationConnectionSchema, raw)
    if (profileId !== null) this.profile(profileId)
    this.settings = this.persist(this.protectKeys(this.settings), { ...this.generation, [role]: profileId })
    return this.getGenerationView()
  }

  generationSnapshot(): GenerationSnapshot {
    if (!this.generation) throw new ConnectionStoreError('invalid-request')
    const generation = this.generation
    return Object.freeze({ ...this.snapshot(), generationMode: generation.generationMode,
      writer: generation.writer === null ? null : this.capture(generation.writer),
      manager: generation.manager === null ? null : this.capture(generation.manager) })
  }

  setGenerationMode(raw: unknown): GenerationSettingsView {
    if (!this.generation) throw new ConnectionStoreError('invalid-request')
    const { generationMode } = validate(SetGenerationModeSchema, raw)
    this.settings = this.persist(this.protectKeys(this.settings), { ...this.generation, generationMode })
    return this.getGenerationView()
  }

  private capture(id: string): CapturedConnection {
    const { id: _id, name: _name, apiKey: _key, apiKeyEncrypted: _encrypted, ...parameters } = this.profile(id)
    let connection: LlmProfile | ConnectionStoreError
    try { connection = this.getProfile(id) } catch { connection = new ConnectionStoreError('credential-unavailable') }
    return Object.freeze({ id, parameters: Object.freeze(parameters), resolve: () => {
      if (connection instanceof ConnectionStoreError) throw connection
      return { ...connection }
    } })
  }

  private resolveProfile(profile: StoredConnectionSettings['profiles'][number]): LlmProfile {
    const { id: _id, name: _name, apiKeyEncrypted, ...connection } = profile
    if (!apiKeyEncrypted) return { ...connection }
    if (!this.cipher || !connection.apiKey) throw new ConnectionStoreError('credential-unavailable')
    try {
      const apiKey = this.cipher.decrypt(connection.apiKey)
      if (typeof apiKey !== 'string' || apiKey.length === 0) throw new Error()
      return { ...connection, apiKey }
    } catch { throw new ConnectionStoreError('credential-unavailable') }
  }

  create(raw: unknown): ConnectionSettingsView {
    const { apiKey = '', ...profile } = validate(CreateConnectionSchema, raw)
    return this.commit({ ...this.settings, profiles: [...this.settings.profiles, { ...profile, id: this.makeId(), apiKey, apiKeyEncrypted: false }] })
  }

  update(raw: unknown): ConnectionSettingsView {
    const { id, changes } = validate(UpdateConnectionSchema, raw)
    const previous = this.profile(id)
    const { apiKey, ...fields } = changes
    this.checkEndpoint(previous, fields.baseUrl ?? previous.baseUrl, apiKey)
    const profile = { ...previous, ...fields, ...(apiKey !== undefined ? { apiKey, apiKeyEncrypted: false } : {}) }
    return this.commit({ ...this.settings, profiles: this.settings.profiles.map((old) => old.id === id ? profile : old) })
  }

  rename(raw: unknown): ConnectionSettingsView {
    const { id, name } = validate(RenameConnectionSchema, raw)
    return this.update({ id, changes: { name } })
  }

  duplicate(raw: unknown): ConnectionSettingsView {
    const { id, name } = validate(DuplicateConnectionSchema, raw)
    const { id: _id, name: _name, apiKey: _key, apiKeyEncrypted: _encrypted, ...profile } = this.profile(id)
    return this.create({ ...profile, name })
  }

  delete(raw: unknown): ConnectionSettingsView {
    const { id } = validate(DeleteConnectionSchema, raw)
    this.profile(id)
    if (Object.values(this.settings.assignments).includes(id) || this.generation?.writer === id || this.generation?.manager === id) throw new ConnectionStoreError('profile-assigned')
    return this.commit({ ...this.settings, profiles: this.settings.profiles.filter((profile) => profile.id !== id) })
  }

  assign(raw: unknown): ConnectionSettingsView {
    const { role, profileId } = validate(AssignConnectionSchema, raw)
    if (profileId !== null) this.profile(profileId)
    return this.commit({ ...this.settings, assignments: { ...this.settings.assignments, [role]: profileId } })
  }

  updatePreferences(raw: unknown): ConnectionSettingsView {
    const preferences = validate(UpdateConnectionPreferencesSchema, raw)
    return this.commit({ ...this.settings, ...preferences })
  }

  /** The existing two-role form saves as one transaction; it never writes the legacy format. */
  saveRoles(raw: unknown): ConnectionSettingsView {
    const request = validate(SaveConnectionRolesSchema, raw)
    const profiles = this.settings.profiles.map((profile) => ({ ...profile }))
    const assignments = { ...this.settings.assignments }
    const changed = new Map<string, string>()
    for (const role of ['main', 'nsfw'] as const) {
      const edit = request[role]
      if (edit.profileId !== assignments[role]) throw new ConnectionStoreError('settings-changed')
      const { apiKey, ...parameters } = edit.profile
      if (edit.profileId !== null) {
        const previous = this.profile(edit.profileId)
        this.checkEndpoint(previous, parameters.baseUrl, apiKey)
        const next = { ...previous, ...parameters, ...(apiKey !== undefined ? { apiKey, apiKeyEncrypted: false } : {}) }
        const serialized = JSON.stringify(next)
        if (changed.has(previous.id) && changed.get(previous.id) !== serialized) throw new ConnectionStoreError('invalid-request')
        changed.set(previous.id, serialized)
        profiles[profiles.findIndex((profile) => profile.id === previous.id)] = next
      } else {
        const defaults = LlmProfileSchema.parse({})
        if (!Object.entries(edit.profile).some(([key, value]) => value !== undefined && value !== defaults[key as keyof LlmProfile])) continue
        const base = t('shell.settings.nsfwTitle')
        let name = base
        for (let n = 2; profiles.some((profile) => profile.name.toLowerCase() === name.toLowerCase()); n++) {
          name = t('shell.settings.numberedName', { name: base, number: n })
        }
        const id = this.makeId()
        profiles.push({ ...parameters, id, name, apiKey: apiKey ?? '', apiKeyEncrypted: false })
        assignments.nsfw = id
      }
    }
    return this.commit({ ...this.settings, profiles, assignments, memoryRecall: request.memoryRecall, newsWebSearch: request.newsWebSearch })
  }

  /** Unsaved endpoint edits cannot borrow a saved key from a different connection address. */
  draftKey(id: string | null, baseUrl: string, apiKey: string | undefined): string {
    if (apiKey !== undefined) return apiKey
    if (id === null) return ''
    const stored = this.profile(id)
    this.checkEndpoint(stored, baseUrl, undefined)
    return stored.apiKey.length > 0 ? this.resolveProfile(stored).apiKey : ''
  }

  private checkEndpoint(previous: StoredConnectionSettings['profiles'][number], baseUrl: string, apiKey: string | undefined): void {
    if (apiKey === undefined && previous.apiKey.length > 0 && !sameConnectionEndpoint(previous.baseUrl, baseUrl)) {
      throw new ConnectionStoreError('endpoint-key-required')
    }
  }

  private profile(id: string): StoredConnectionSettings['profiles'][number] {
    const profile = this.settings.profiles.find((one) => one.id === id)
    if (!profile) throw new ConnectionStoreError('profile-not-found')
    return profile
  }

  private protectKeys(settings: StoredConnectionSettings): StoredConnectionSettings {
    const profiles = settings.profiles.map((profile) => {
      if (!profile.apiKey || profile.apiKeyEncrypted) return profile
      if (!this.cipher) throw new ConnectionStoreError('encryption-unavailable')
      try {
        const apiKey = this.cipher.encrypt(profile.apiKey)
        if (typeof apiKey !== 'string' || apiKey.length === 0) throw new Error()
        return { ...profile, apiKey, apiKeyEncrypted: true }
      } catch { throw new ConnectionStoreError('encryption-unavailable') }
    })
    return validate(StoredConnectionSettingsSchema, { ...settings, profiles })
  }

  private commit(raw: unknown): ConnectionSettingsView {
    const candidate = this.protectKeys(validate(StoredConnectionSettingsSchema, raw))
    this.settings = this.persist(candidate)
    return this.getView()
  }

  private persist(settings: StoredConnectionSettings, generation = this.generation): StoredConnectionSettings {
    const stored = generation ? validate(StoredGenerationSettingsSchema, { ...settings,
      settingsVersion: GENERATION_SETTINGS_VERSION, generationMode: generation.generationMode,
      assignments: { ...settings.assignments, writer: generation.writer, manager: generation.manager } }) : settings
    const bytes = Buffer.from(`${JSON.stringify(stored, null, 2)}\n`, 'utf8')
    try { writeConnectionFile(this.path, bytes, this.files, () => this.assertUnchanged()) } catch (error) {
      if (error instanceof ConnectionStoreError) throw error
      throw new ConnectionStoreError('write-failed')
    }
    this.fileContents = bytes
    this.generation = generation
    return settings
  }

  private read(): Buffer | undefined {
    try { return this.files.readFileSync(this.path) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw new ConnectionStoreError('read-failed')
    }
  }

  private assertUnchanged(): void {
    const current = this.read()
    if (current === undefined ? this.fileContents !== undefined : this.fileContents === undefined || !current.equals(this.fileContents)) {
      throw new ConnectionStoreError('settings-changed')
    }
  }
}
