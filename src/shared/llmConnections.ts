import { z } from 'zod'
import { LlmProfileSchema, SettingsSchema } from './settings'

export const CONNECTION_SETTINGS_VERSION = 2
export const CONNECTION_ROLES = ['main', 'nsfw'] as const
export type ConnectionRole = (typeof CONNECTION_ROLES)[number]

export const ConnectionProfileIdSchema = z.uuid().toLowerCase()
export type ConnectionProfileId = z.infer<typeof ConnectionProfileIdSchema>

// Credentials belong to the main-process storage model, not this shared connection description.
export const ConnectionProfileSchema = LlmProfileSchema.omit({ apiKey: true }).extend({
  id: ConnectionProfileIdSchema,
  name: z.string().trim().min(1)
}).strict()
export type ConnectionProfile = z.infer<typeof ConnectionProfileSchema>

export const ConnectionSettingsSchema = SettingsSchema.pick({
  language: true,
  memoryRecall: true,
  newsWebSearch: true
}).extend({
  settingsVersion: z.literal(CONNECTION_SETTINGS_VERSION),
  profiles: z.array(ConnectionProfileSchema).min(1),
  assignments: z.object({
    main: ConnectionProfileIdSchema,
    nsfw: ConnectionProfileIdSchema.nullable()
  }).strict()
}).strict().superRefine((settings, context) => {
  const ids = new Set<string>()
  const names = new Set<string>()
  settings.profiles.forEach((profile, index) => {
    if (ids.has(profile.id)) {
      context.addIssue({ code: 'custom', path: ['profiles', index, 'id'], message: 'Profile IDs must be unique.' })
    }
    ids.add(profile.id)
    const name = profile.name.toLowerCase()
    if (names.has(name)) {
      context.addIssue({ code: 'custom', path: ['profiles', index, 'name'], message: 'Profile names must be unique.' })
    }
    names.add(name)
  })
  for (const role of CONNECTION_ROLES) {
    const id = settings.assignments[role]
    if (id !== null && !ids.has(id)) {
      context.addIssue({ code: 'custom', path: ['assignments', role], message: 'Assigned profile does not exist.' })
    }
  }
})
export type ConnectionSettings = z.infer<typeof ConnectionSettingsSchema>

export const ConnectionProfileViewSchema = ConnectionProfileSchema.extend({ hasApiKey: z.boolean() })
export const ConnectionSettingsViewSchema = ConnectionSettingsSchema.safeExtend({
  profiles: z.array(ConnectionProfileViewSchema).min(1),
  encryptionAvailable: z.boolean()
})
export type ConnectionSettingsView = z.infer<typeof ConnectionSettingsViewSchema>

// Defaults create new profiles; they must not reset fields omitted from an edit.
type PatchShape<S extends Record<string, z.ZodType>> = {
  [K in keyof S]: z.ZodOptional<S[K] extends z.ZodDefault<infer Inner> ? Inner : S[K]>
}
function patchShape<S extends Record<string, z.ZodType>>(shape: S): PatchShape<S> {
  return Object.fromEntries(Object.entries(shape).map(([key, field]) => [
    key, z.optional(field instanceof z.ZodDefault ? field.removeDefault() : field)
  ])) as PatchShape<S>
}

const EditableProfileSchema = ConnectionProfileSchema.omit({ id: true })
export const ConnectionParametersSchema = LlmProfileSchema.omit({ apiKey: true }).extend({ apiKey: z.string().optional() }).strict()
export const ListConnectionModelsSchema = z.object({
  profileId: ConnectionProfileIdSchema.nullable(), baseUrl: z.string(), apiKey: z.string().optional()
}).strict()
export const TestConnectionSchema = z.object({
  profileId: ConnectionProfileIdSchema.nullable(), profile: ConnectionParametersSchema
}).strict()
export const SaveConnectionRolesSchema = z.object({
  main: z.object({ profileId: ConnectionProfileIdSchema, profile: ConnectionParametersSchema }).strict(),
  nsfw: z.object({ profileId: ConnectionProfileIdSchema.nullable(), profile: ConnectionParametersSchema }).strict(),
  memoryRecall: SettingsSchema.shape.memoryRecall.removeDefault(),
  newsWebSearch: SettingsSchema.shape.newsWebSearch.removeDefault()
}).strict()
export const CreateConnectionSchema = EditableProfileSchema.extend({ apiKey: z.string().optional() })
export const UpdateConnectionSchema = z.object({
  id: ConnectionProfileIdSchema,
  changes: z.object(patchShape(EditableProfileSchema.shape)).extend({ apiKey: z.string().optional() }).strict()
}).strict()
export const RenameConnectionSchema = z.object({ id: ConnectionProfileIdSchema, name: ConnectionProfileSchema.shape.name }).strict()
export const DuplicateConnectionSchema = RenameConnectionSchema
export const DeleteConnectionSchema = z.object({ id: ConnectionProfileIdSchema }).strict()
export const AssignConnectionSchema = z.object({
  role: z.enum(CONNECTION_ROLES),
  profileId: ConnectionProfileIdSchema.nullable()
}).strict().refine((request) => request.role !== 'main' || request.profileId !== null, {
  path: ['profileId'], message: 'The main profile cannot be unset.'
})
export const UpdateConnectionPreferencesSchema = z.object(patchShape(SettingsSchema.pick({
  language: true, memoryRecall: true, newsWebSearch: true
}).shape)).strict()

export const CONNECTION_ERROR_CODES = [
  'invalid-request', 'invalid-settings', 'read-failed', 'write-failed', 'backup-failed', 'settings-changed',
  'profile-not-found', 'profile-assigned', 'encryption-unavailable', 'credential-unavailable', 'endpoint-key-required', 'forbidden', 'internal-error'
] as const
export type ConnectionErrorCode = (typeof CONNECTION_ERROR_CODES)[number]
export const ConnectionResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), settings: ConnectionSettingsViewSchema }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: z.enum(CONNECTION_ERROR_CODES), message: z.string() }).strict() }).strict()
])
export type ConnectionResult = z.infer<typeof ConnectionResultSchema>

export interface ConnectionApi {
  get(): Promise<ConnectionResult>
  create(request: z.input<typeof CreateConnectionSchema>): Promise<ConnectionResult>
  update(request: z.input<typeof UpdateConnectionSchema>): Promise<ConnectionResult>
  rename(request: z.input<typeof RenameConnectionSchema>): Promise<ConnectionResult>
  duplicate(request: z.input<typeof DuplicateConnectionSchema>): Promise<ConnectionResult>
  delete(request: z.input<typeof DeleteConnectionSchema>): Promise<ConnectionResult>
  assign(request: z.input<typeof AssignConnectionSchema>): Promise<ConnectionResult>
  updatePreferences(request: z.input<typeof UpdateConnectionPreferencesSchema>): Promise<ConnectionResult>
  saveRoles(request: z.input<typeof SaveConnectionRolesSchema>): Promise<ConnectionResult>
  listModels(request: z.input<typeof ListConnectionModelsSchema>): Promise<{ models: string[]; error?: string }>
  test(request: z.input<typeof TestConnectionSchema>): Promise<{ ok: boolean; message: string }>
}
