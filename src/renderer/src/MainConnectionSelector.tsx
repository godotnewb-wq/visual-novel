import { useEffect, useRef, useState } from 'react'
import type { ConnectionSettingsView } from '../../shared/llmConnections'
import { t } from '../../shared/i18n'
import { connectionSettings } from './connectionForm'
import { errorMessage } from './errors'
import { Button } from './ui/Button'

export function MainConnectionSelector({ busy }: { busy: boolean }) {
  const [settings, setSettings] = useState<ConnectionSettingsView | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const changing = useRef(false)

  // Reopening the menu reads assignments and names edited in Settings.
  useEffect(() => {
    let cancelled = false
    setError('')
    window.api.connections.get().then((result) => {
      const view = connectionSettings(result)
      if (!cancelled) setSettings(view)
    }).catch((error) => { if (!cancelled) setError(errorMessage(error)) })
    return () => { cancelled = true }
  }, [reload])

  async function select(profileId: string) {
    if (busy || changing.current || !settings || profileId === settings.assignments.main) return
    changing.current = true
    setPending(true)
    setError('')
    try {
      const next = connectionSettings(await window.api.connections.assign({ role: 'main', profileId }))
      setSettings(next)
    } catch (error) { setError(errorMessage(error)) }
    finally { changing.current = false; setPending(false) }
  }

  return <div className="main-connection-selector">
    <label title={busy ? t('shell.settings.assignBusy') : t('shell.settings.mainAssignmentTitle')}>
      {t('shell.settings.mainTitle')}
      <select value={settings?.assignments.main ?? ''} disabled={busy || pending || !settings} onChange={(event) => void select(event.target.value)}>
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
