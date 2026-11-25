import { LlmProfileSchema, isConfigured, type LlmProfileView } from '../../shared/settings'
import type { ConnectionResult, ConnectionRole, ConnectionSettingsView } from '../../shared/llmConnections'

export interface ProfileForm extends LlmProfileView {
  profileId: string | null
  apiKeyInput: string
  clearKey: boolean
}
export type ConnectionForm = Record<ConnectionRole, ProfileForm> & { memoryRecall: number; newsWebSearch: boolean }

export function connectionSettings(result: ConnectionResult): ConnectionSettingsView {
  if (!result.ok) throw new Error(result.error.message)
  return result.settings
}

export function connectionForm(view: ConnectionSettingsView): ConnectionForm {
  const role = (role: ConnectionRole): ProfileForm => {
    const profile = view.profiles.find((profile) => profile.id === view.assignments[role])
    return {
      ...LlmProfileSchema.omit({ apiKey: true }).parse(profile ?? {}),
      profileId: profile?.id ?? null, hasApiKey: profile?.hasApiKey ?? false, apiKeyInput: '', clearKey: false
    }
  }
  return { main: role('main'), nsfw: role('nsfw'), memoryRecall: view.memoryRecall, newsWebSearch: view.newsWebSearch }
}

export function formProfile(form: ProfileForm) {
  const { profileId: _id, hasApiKey: _has, apiKeyInput, clearKey, ...profile } = form
  return { ...profile, apiKey: clearKey ? '' : apiKeyInput || undefined }
}

export function changeConnectionForm(form: ConnectionForm, role: ConnectionRole, patch: Partial<ProfileForm>): ConnectionForm {
  const other = role === 'main' ? 'nsfw' : 'main'
  return {
    ...form, [role]: { ...form[role], ...patch },
    ...(form[role].profileId !== null && form[role].profileId === form[other].profileId ? { [other]: { ...form[other], ...patch } } : {})
  }
}

export function assignedConnection(view: ConnectionSettingsView, nsfw: boolean) {
  const secondary = view.profiles.find((profile) => profile.id === view.assignments.nsfw)
  return nsfw && secondary && isConfigured(secondary) ? secondary : view.profiles.find((profile) => profile.id === view.assignments.main)
}
