import { GenerationResultSchema, type GenerationSettingsView } from '../../shared/generationConnections'

export const GENERATION_CHANGED = 'breedhaven:generation-changed'
export function generationSettings(raw: unknown): GenerationSettingsView {
  const result = GenerationResultSchema.parse(raw)
  if (!result.ok) throw new Error(result.error.message)
  return result.settings
}
export function announceGeneration(settings: GenerationSettingsView) {
  window.dispatchEvent(new CustomEvent(GENERATION_CHANGED, { detail: settings.generationMode }))
}
