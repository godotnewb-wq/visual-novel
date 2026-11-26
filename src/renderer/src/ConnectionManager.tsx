import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CONNECTION_ROLES, type ConnectionRole, type ConnectionSettingsView } from '../../shared/llmConnections'
import { t } from '../../shared/i18n'
import { connectionSettings } from './connectionForm'
import { connectionPreferences, libraryDirty, libraryDraft, libraryProfile, uniqueConnectionName, type ConnectionPreferences, type LibraryDraft } from './connectionLibrary'
import { ConnectionProfileFields } from './ConnectionProfileFields'
import { Button } from './ui/Button'
import { useConfirm } from './ui/Confirm'
import { errorMessage } from './errors'
import { GenerationControls } from './GenerationControls'
import type { GenerationSettingsView } from '../../shared/generationConnections'

interface Props {
  generating: boolean
  onDirtyChange: (dirty: boolean) => void
  onBusyChange: (busy: boolean) => void
  confirmDiscard: () => Promise<boolean>
}

const roleLabel = (role: ConnectionRole) => t(role === 'main' ? 'shell.settings.mainTitle' : 'shell.settings.nsfwTitle')

export function ConnectionManager({ generating, onDirtyChange, onBusyChange, confirmDiscard }: Props) {
  const [view, setView] = useState<ConnectionSettingsView | null>(null)
  const [draft, setDraft] = useState<LibraryDraft | null>(null)
  const [preferences, setPreferences] = useState<ConnectionPreferences | null>(null)
  const [busy, setBusy] = useState(false)
  const [generationBusy, setGenerationBusy] = useState(false)
  const [generation, setGeneration] = useState<GenerationSettingsView | null>(null)
  const [status, setStatus] = useState('')
  const [editorVersion, setEditorVersion] = useState(0)
  const running = useRef(false)
  const { ask, dialog } = useConfirm()
  const profileDirty = !!(view && draft && libraryDirty(draft, view))
  const preferencesDirty = !!(view && preferences && (preferences.memoryRecall !== view.memoryRecall || preferences.newsWebSearch !== view.newsWebSearch))

  useEffect(() => onDirtyChange(profileDirty || preferencesDirty), [profileDirty, preferencesDirty, onDirtyChange])
  useEffect(() => onBusyChange(busy || generationBusy), [busy, generationBusy, onBusyChange])
  useEffect(() => {
    let cancelled = false
    window.api.connections.get().then((result) => {
      const next = connectionSettings(result)
      if (!cancelled) { setView(next); setDraft(libraryDraft(next.profiles.find((p) => p.id === next.assignments.main))); setPreferences(connectionPreferences(next)) }
    }).catch((error) => { if (!cancelled) setStatus(errorMessage(error)) })
    return () => { cancelled = true }
  }, [])

  function show(next: ConnectionSettingsView, id: string, discardPreferences = false) {
    setView(next)
    setDraft(libraryDraft(next.profiles.find((profile) => profile.id === id)))
    setEditorVersion((version) => version + 1)
    if (discardPreferences) setPreferences(connectionPreferences(next))
  }

  async function run(action: () => Promise<void>) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setStatus('')
    try { await action() } catch (error) { setStatus(errorMessage(error)) }
    finally { running.current = false; setBusy(false) }
  }

  async function select(id: string | null) {
    if (!view || busy || (id !== null && id === draft?.profileId) || !await confirmDiscard()) return
    setStatus('')
    setDraft(id === null ? libraryDraft(undefined, uniqueConnectionName(view, t('shell.settings.newProfile'))) : libraryDraft(view.profiles.find((profile) => profile.id === id)))
    setPreferences(connectionPreferences(view))
    setEditorVersion((version) => version + 1)
  }

  function save(event: FormEvent) {
    event.preventDefault()
    if (!draft) return
    void run(async () => {
      const result = draft.profileId === null
        ? await window.api.connections.create(libraryProfile(draft))
        : await window.api.connections.update({ id: draft.profileId, changes: libraryProfile(draft) })
      const next = connectionSettings(result)
      const id = draft.profileId ?? next.profiles.find((profile) => !view?.profiles.some((old) => old.id === profile.id))!.id
      show(next, id)
      setStatus(t('shell.settings.saved'))
    })
  }

  async function duplicate() {
    if (!view || !draft?.profileId || !await confirmDiscard()) return
    const id = draft.profileId
    const original = view.profiles.find((profile) => profile.id === id)!
    void run(async () => {
      const next = connectionSettings(await window.api.connections.duplicate({ id, name: uniqueConnectionName(view, t('shell.settings.copyName', { name: original.name })) }))
      show(next, next.profiles.find((profile) => !view.profiles.some((old) => old.id === profile.id))!.id, true)
      setStatus(t('shell.settings.saved'))
    })
  }

  async function remove() {
    if (!view || !draft?.profileId || !await confirmDiscard()) return
    const id = draft.profileId
    const original = view.profiles.find((profile) => profile.id === id)!
    if (!await ask({ title: t('shell.settings.deleteTitle', { name: original.name }), detail: t('shell.settings.deleteDetail'), confirm: t('shell.settings.delete'), grave: true })) return
    void run(async () => {
      const next = connectionSettings(await window.api.connections.delete({ id }))
      show(next, next.assignments.main, true)
      setStatus(t('shell.settings.saved'))
    })
  }

  function assign(role: ConnectionRole, profileId: string | null) {
    if (generating) return
    void run(async () => { setView(connectionSettings(await window.api.connections.assign({ role, profileId }))) })
  }

  if (!view || !draft || !preferences) return <div role="status">
    <p>{status || t('shell.app.loading')}</p>
    {status && <Button disabled={busy} onClick={() => void run(async () => {
      const next = connectionSettings(await window.api.connections.get())
      show(next, next.assignments.main, true)
    })}>{t('shell.settings.retry')}</Button>}
  </div>

  const assigned = Object.values(generation?.assignments ?? view.assignments).includes(draft.profileId ?? '')
  const change = (patch: Partial<LibraryDraft>) => { setDraft({ ...draft, ...patch }); setStatus('') }

  return <>
    <GenerationControls library={view} disabled={busy || generationBusy || generating} onBusy={setGenerationBusy} onView={setGeneration} />
    <fieldset disabled={generationBusy} className="connection-library-controls">
    <div className="connection-assignments">
      {CONNECTION_ROLES.map((role) => <label key={role} title={generating ? t('shell.settings.assignBusy') : undefined}>
        {roleLabel(role)}
        <select value={view.assignments[role] ?? ''} disabled={busy || generating} onChange={(event) => assign(role, event.target.value || null)}>
          {role === 'nsfw' && <option value="">{t('shell.settings.none')}</option>}
          {view.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
      </label>)}
    </div>
    <div className="connection-manager">
      <section className="connection-library" aria-label={t('shell.settings.profiles')}>
        <h2>{t('shell.settings.profiles')}</h2>
        <ul>
          {view.profiles.map((profile) => <li key={profile.id}>
            <Button disabled={busy} aria-pressed={draft.profileId === profile.id} onClick={() => void select(profile.id)}>
              <span>{profile.name}</span>
              <small>{[...CONNECTION_ROLES.filter((role) => view.assignments[role] === profile.id).map(roleLabel),
                ...(generation?.assignments.writer === profile.id ? [t('scene.dual.writerProfile')] : []),
                ...(generation?.assignments.manager === profile.id ? [t('scene.dual.managerProfile')] : [])].join(' · ') || t('shell.settings.unassigned')}</small>
            </Button>
          </li>)}
        </ul>
        <Button disabled={busy} onClick={() => void select(null)}>{t('shell.settings.newProfile')}</Button>
      </section>
      <form className="settings-form connection-editor" onSubmit={save}>
        <fieldset key={editorVersion} disabled={busy}>
          <legend>{draft.profileId === null ? t('shell.settings.newProfile') : view.profiles.find((profile) => profile.id === draft.profileId)?.name}</legend>
          <label>{t('shell.settings.profileName')}<input required value={draft.name} onChange={(event) => change({ name: event.target.value })} /></label>
          {!view.encryptionAvailable && <p className="status">{t('shell.settings.encryptionUnavailable')}</p>}
          <ConnectionProfileFields profile={draft} onChange={change} />
          <div className="actions">
            <Button title={t('shell.settings.testCost')} onClick={() => void run(async () => {
              const { name: _name, ...profile } = libraryProfile(draft)
              setStatus(t('shell.settings.testing'))
              const result = await window.api.connections.test({ profileId: draft.profileId, profile })
              setStatus(result.message)
            })}>{t('shell.settings.test')}</Button>
            <Button disabled={draft.profileId === null} title={t('shell.settings.duplicateTitle')} onClick={() => void duplicate()}>{t('shell.settings.duplicate')}</Button>
            <Button variant="danger" disabled={draft.profileId === null || assigned} title={assigned ? t('shell.settings.assignedDelete') : undefined} onClick={() => void remove()}>{t('shell.settings.delete')}</Button>
          </div>
          <div className="actions">
            <Button type="submit" variant="primary" disabled={!profileDirty}>{t('shell.settings.save')}</Button>
            <Button disabled={!profileDirty} onClick={() => { show(view, draft.profileId ?? view.assignments.main); setStatus('') }}>{t('shell.common.cancel')}</Button>
          </div>
        </fieldset>
      </form>
    </div>
    <form className="settings-form connection-preferences" onSubmit={(event) => {
      event.preventDefault()
      void run(async () => {
        const next = connectionSettings(await window.api.connections.updatePreferences(preferences))
        setView(next); setPreferences(connectionPreferences(next)); setStatus(t('shell.settings.saved'))
      })
    }}>
      <fieldset disabled={busy}>
        <legend>{t('shell.settings.preferences')}</legend>
        <label title={t('shell.settings.memoryRecallTitle')}>{t('shell.settings.memoryRecall')}
          <input type="number" min={1} step={1} value={preferences.memoryRecall} onChange={(event) => setPreferences({ ...preferences, memoryRecall: Math.max(1, Math.round(event.target.valueAsNumber || 1)) })} />
        </label>
        <label className="inline" title={t('shell.settings.newsWebSearchTitle')}>
          <input type="checkbox" checked={preferences.newsWebSearch} onChange={(event) => setPreferences({ ...preferences, newsWebSearch: event.target.checked })} />
          {t('shell.settings.newsWebSearch')}
        </label>
        <div className="actions">
          <Button type="submit" variant="primary" disabled={!preferencesDirty}>{t('shell.settings.save')}</Button>
          <Button disabled={!preferencesDirty} onClick={() => setPreferences(connectionPreferences(view))}>{t('shell.common.cancel')}</Button>
        </div>
      </fieldset>
    </form>
    <p className="status" role="status" aria-live="polite">{status}</p>
    </fieldset>
    {dialog}
  </>
}
