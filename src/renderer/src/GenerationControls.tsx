import { useEffect, useRef, useState } from 'react'
import type { ConnectionSettingsView } from '../../shared/llmConnections'
import type { GenerationSettingsView, GenerationRole } from '../../shared/generationConnections'
import { isConfigured } from '../../shared/settings'
import { t } from '../../shared/i18n'
import { announceGeneration, generationSettings } from './generationSettings'
import { errorMessage } from './errors'

export function GenerationControls({ library, disabled, onBusy, onView }: { library: ConnectionSettingsView; disabled: boolean;
  onBusy: (busy: boolean) => void; onView: (view: GenerationSettingsView) => void }) {
  const [view, setView] = useState<GenerationSettingsView | null>(null)
  const [error, setError] = useState('')
  const running = useRef(false)
  useEffect(() => {
    let cancelled = false
    window.api.generation.get().then((raw) => { if (!cancelled) { const next = generationSettings(raw); setView(next); onView(next) } })
      .catch((error) => { if (!cancelled) setError(errorMessage(error)) })
    return () => { cancelled = true }
  }, [library, onView])
  async function change(action: () => ReturnType<typeof window.api.generation.get>) {
    if (disabled || running.current) return
    running.current = true; onBusy(true); setError('')
    try { const next = generationSettings(await action()); setView(next); onView(next); announceGeneration(next) }
    catch (error) { setError(errorMessage(error)) }
    finally { running.current = false; onBusy(false) }
  }
  const ready = view && (['writer', 'manager'] as const).every((role) => view.profiles.some((profile) => profile.id === view.assignments[role] && isConfigured(profile)))
  return <>
    <div className="connection-assignments">
      <label title={t('scene.dual.nextScene')}>{t('scene.dual.mode')}
        <select value={view?.generationMode ?? 'legacy'} disabled={disabled || !view} onChange={(event) => void change(() => window.api.generation.setMode({ generationMode: event.target.value as 'legacy' | 'dual' }))}>
          <option value="legacy">{t('scene.dual.legacy')}</option>
          <option value="dual" disabled={!ready} title={!ready ? t('scene.dual.assignFirst') : undefined}>{t('scene.dual.dual')}</option>
        </select>
      </label>
      {(['writer', 'manager'] as const).map((role: GenerationRole) => <label key={role} title={t('scene.dual.nextTurn')}>
        {t(role === 'writer' ? 'scene.dual.writerProfile' : 'scene.dual.managerProfile')}
        <select value={view?.assignments[role] ?? ''} disabled={disabled || !view} onChange={(event) => void change(() => window.api.generation.assign({ role, profileId: event.target.value || null }))}>
          <option value="" disabled={view?.generationMode === 'dual'}>{t('shell.settings.none')}</option>
          {library.profiles.map((profile) => <option key={profile.id} value={profile.id} disabled={view?.generationMode === 'dual' && !isConfigured(profile)}>{profile.name}</option>)}
        </select>
      </label>)}
    </div>
    {error && <p className="status" role="status">{error}</p>}
  </>
}
