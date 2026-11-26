import { z } from 'zod'
import { ConnectionProfileSchema, ConnectionProfileIdSchema, ConnectionProfileViewSchema, ConnectionSettingsSchema } from './llmConnections'
import { isConfigured } from './settings'
import { CONNECTION_ERROR_CODES } from './llmConnections'

export const GENERATION_SETTINGS_VERSION = 3
export const GENERATION_ROLES = ['writer', 'manager'] as const
export type GenerationRole = (typeof GENERATION_ROLES)[number]
export const GenerationSettingsSchema = z.object({
  ...ConnectionSettingsSchema.shape,
  settingsVersion: z.literal(GENERATION_SETTINGS_VERSION),
  generationMode: z.enum(['legacy', 'dual']),
  assignments: z.object({
    ...ConnectionSettingsSchema.shape.assignments.shape,
    writer: ConnectionProfileIdSchema.nullable(), manager: ConnectionProfileIdSchema.nullable()
  }).strict()
}).strict().superRefine((settings, context) => {
  // Reuse the library invariants while projecting only fields belonging to the older safe view.
  const legacy = ConnectionSettingsSchema.safeParse({
    settingsVersion: 2, language: settings.language, memoryRecall: settings.memoryRecall, newsWebSearch: settings.newsWebSearch,
    assignments: { main: settings.assignments.main, nsfw: settings.assignments.nsfw },
    profiles: settings.profiles.map((profile) => Object.fromEntries(Object.entries(profile).filter(([key]) => Object.hasOwn(ConnectionProfileSchema.shape, key))))
  })
  if (!legacy.success) for (const issue of legacy.error.issues) context.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  for (const role of GENERATION_ROLES) {
    const id = settings.assignments[role]
    const profile = settings.profiles.find((item) => item.id === id)
    if (id !== null && !profile) context.addIssue({ code: 'custom', path: ['assignments', role], message: 'Assigned profile does not exist.' })
    if (settings.generationMode === 'dual' && (!profile || !isConfigured(profile))) {
      context.addIssue({ code: 'custom', path: ['assignments', role], message: 'Dual-call requires a configured profile for each role.' })
    }
  }
})
export type GenerationSettings = z.infer<typeof GenerationSettingsSchema>
export const GenerationSettingsViewSchema = GenerationSettingsSchema.safeExtend({
  profiles: z.array(ConnectionProfileViewSchema).min(1), encryptionAvailable: z.boolean()
})
export type GenerationSettingsView = z.infer<typeof GenerationSettingsViewSchema>
export const AssignGenerationConnectionSchema = z.object({
  role: z.enum(GENERATION_ROLES), profileId: ConnectionProfileIdSchema.nullable()
}).strict()
export const SetGenerationModeSchema = z.object({ generationMode: z.enum(['legacy', 'dual']) }).strict()
export const GenerationResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), settings: GenerationSettingsViewSchema }).strict(),
  z.object({ ok: z.literal(false), error: z.object({ code: z.enum(CONNECTION_ERROR_CODES), message: z.string() }).strict() }).strict()
])
export type GenerationResult = z.infer<typeof GenerationResultSchema>
export interface GenerationApi {
  get(): Promise<GenerationResult>
  assign(request: z.infer<typeof AssignGenerationConnectionSchema>): Promise<GenerationResult>
  setMode(request: z.infer<typeof SetGenerationModeSchema>): Promise<GenerationResult>
}
