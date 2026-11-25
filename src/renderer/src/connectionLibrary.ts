import { LlmProfileSchema } from '../../shared/settings'
import type { ConnectionProfileViewSchema, ConnectionSettingsView } from '../../shared/llmConnections'
import type { z } from 'zod'
import { t } from '../../shared/i18n'
import { formProfile, type ProfileForm } from './connectionForm'

export interface LibraryDraft extends ProfileForm { name: string }
export type ConnectionPreferences = Pick<ConnectionSettingsView, 'memoryRecall' | 'newsWebSearch'>

export function libraryDraft(profile?: z.infer<typeof ConnectionProfileViewSchema>, name = ''): LibraryDraft {
  return {
    ...LlmProfileSchema.omit({ apiKey: true }).parse(profile ?? {}),
    name: profile?.name ?? name, profileId: profile?.id ?? null,
    hasApiKey: profile?.hasApiKey ?? false, apiKeyInput: '', clearKey: false
  }
}

export function libraryProfile(draft: LibraryDraft) {
  const { name, ...profile } = draft
  return { ...formProfile(profile), name: name.trim() }
}

export function libraryDirty(draft: LibraryDraft, view: ConnectionSettingsView): boolean {
  const original = view.profiles.find((profile) => profile.id === draft.profileId)
  return !original || JSON.stringify(draft) !== JSON.stringify(libraryDraft(original))
}

export function uniqueConnectionName(view: ConnectionSettingsView, base: string): string {
  const used = new Set(view.profiles.map((profile) => profile.name.toLowerCase()))
  let name = base.trim()
  for (let number = 2; used.has(name.toLowerCase()); number++) name = t('shell.settings.numberedName', { name: base.trim(), number })
  return name
}

export function connectionPreferences(view: ConnectionSettingsView): ConnectionPreferences {
  return { memoryRecall: view.memoryRecall, newsWebSearch: view.newsWebSearch }
}
