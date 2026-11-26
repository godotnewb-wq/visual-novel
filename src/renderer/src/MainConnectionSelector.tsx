import { useEffect, useRef, useState } from 'react'
import type { GenerationSettingsView } from '../../shared/generationConnections'
import { generationSettings } from './generationSettings'
import { t } from '../../shared/i18n'
import { connectionSettings } from './connectionForm'
import { errorMessage } from './errors'
import { Button } from './ui/Button'

export function MainConnectionSelector({ busy, mode }: { busy: boolean; mode?: 'legacy' | 'dual' }) {
  const [settings, setSettings] = useState<GenerationSettingsView | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const changing = useRef(false)

  // Reopening the menu reads assignments and names edited in Settings.
  useEffect(() => {
    let cancelled = false
    setError('')
    window.api.generation.get().then((result) => {
      const view = generationSettings(result)
      if (!cancelled) setSettings(view)
    }).catch((error) => { if (!cancelled) setError(errorMessage(error)) })
    return () => { cancelled = true }
  }, [reload])
  const role = (mode ?? settings?.generationMode) === 'dual' ? 'writer' : 'main'

  async function select(profileId: string) {
    if (busy || changing.current || !settings || profileId === settings.assignments[role]) return
    changing.current = true
    setPending(true)
    setError('')
    try {
      if (role === 'main') connectionSettings(await window.api.connections.assign({ role: 'main', profileId }))
      else generationSettings(await window.api.generation.assign({ role: 'writer', profileId }))
      const next = generationSettings(await window.api.generation.get())
      setSettings(next)
    } catch (error) { setError(errorMessage(error)) }
    finally { changing.current = false; setPending(false) }
  }

  return <div className="main-connection-selector">
    <label title={busy ? t('shell.settings.assignBusy') : t('shell.settings.mainAssignmentTitle')}>
      {t(role === 'writer' ? 'scene.dual.writerProfile' : 'shell.settings.mainTitle')}
      <select value={settings?.assignments[role] ?? ''} disabled={busy || pending || !settings} onChange={(event) => void select(event.target.value)}>
        {settings && !settings.assignments[role] && <option value="">{t('shell.settings.none')}</option>}
        {!settings && <option value="">{t('shell.app.loading')}</option>}
        {settings?.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
      </select>
    </label>
    {error && <div role="status" aria-live="polite">
      <p>{error}</p>
      <Button size="small" disabled={pending} onClick={() => setReload((value) => value + 1)}>{t('shell.settings.retry')}</Button>
    </div>}
  </div>
}
