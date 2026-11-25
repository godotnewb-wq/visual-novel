import { useRef, useState } from 'react'
import { Overlay } from './ui/Dialog'
import { useConfirm } from './ui/Confirm'
import { ComfySetupPanel } from './ui/art/ComfySetup'
import { setVolume, useVolumes, VOLUME_KINDS, type VolumeKind } from './sound'
import { chooseLanguage, useLanguageView } from './language'
import { t, type MessageKey } from '../../shared/i18n'
import { Button } from './ui/Button'
import { ConnectionManager } from './ConnectionManager'
import { errorMessage } from './errors'

// What the settings are for, a tab each.
const TABS = ['llms', 'comfy', 'sound', 'credits'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, MessageKey> = { llms: 'shell.settings.tabLlms', comfy: 'shell.settings.tabComfy', sound: 'shell.settings.tabSound', credits: 'shell.settings.tabCredits' }

// Who made the game, and who backs it, each under its heading: names, said as they are.
const CREDITS: { heading: MessageKey; names: string[] }[] = [
  { heading: 'shell.credits.creator', names: ['Potatoman760'] },
  { heading: 'shell.credits.patreonDirectors', names: ['elby', 'syphen'] }
]

const VOLUME_LABELS: Record<VolumeKind, MessageKey> = { effects: 'shell.settings.effects', ambience: 'shell.settings.ambience', music: 'shell.settings.music' }

export function SettingsPanel({ onClose, generating = false }: { onClose: () => void; generating?: boolean }) {
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>('llms')
  const [error, setError] = useState('')
  const confirming = useRef(false)
  const { ask, dialog } = useConfirm()
  const volumes = useVolumes()
  const languages = useLanguageView()

  async function confirmDiscard(): Promise<boolean> {
    if (busy || confirming.current) return false
    if (!dirty) return true
    confirming.current = true
    try {
      return await ask({ title: t('shell.settings.discardTitle'), confirm: t('shell.settings.discard'), grave: true })
    } finally { confirming.current = false }
  }
  const close = () => { void confirmDiscard().then((yes) => { if (yes) onClose() }) }
  async function navigate(next: Tab) {
    if (next !== tab && await confirmDiscard()) { setDirty(false); setTab(next) }
  }
  async function language(next: string) {
    setBusy(true)
    setError('')
    try { await chooseLanguage(next) } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return (
    <>
    <Overlay onClose={close}>
      <div className="settings wide">
        <h1>{t('shell.settings.title')}</h1>
        {/* Offered once there is a translation to choose; changed as soon as it is picked. */}
        {languages && languages.languages.length > 1 && (
          <label className="language">
            {t('core.settings.language')}
            <select value={languages.language} disabled={busy} onChange={(e) => void language(e.target.value)}>
              {languages.languages.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p role="status">{error}</p>}
        <div className="tabs" role="tablist">
          {TABS.map((name) => (
            <Button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'tab selected' : 'tab'} disabled={busy} onClick={() => void navigate(name)}>
              {t(TAB_LABELS[name])}
            </Button>
          ))}
        </div>
        {/* ComfyUI draws the pictures: Bloomr's selfies in play. Here is only how it is reached. Each change is saved as it is made. */}
        {tab === 'comfy' && (
          <>
            <ComfySetupPanel connectionOnly />
          </>
        )}
        {/* How loud each kind of sound is, kept on this computer and applied as the slider moves. */}
        {tab === 'sound' && (
          <>
            <div className="volumes">
              {VOLUME_KINDS.map((kind) => (
                <label key={kind}>
                  {t('shell.settings.volume', { kind: t(VOLUME_LABELS[kind]), percent: Math.round(volumes[kind] * 100) })}
                  <input type="range" min={0} max={100} value={Math.round(volumes[kind] * 100)} onChange={(e) => setVolume(kind, Number(e.target.value) / 100)} />
                </label>
              ))}
            </div>
          </>
        )}
        {tab === 'credits' && (
          <>
            <div className="credits">
              {CREDITS.map(({ heading, names }) => (
                <section key={heading}>
                  <h2>{t(heading)}</h2>
                  <ul>
                    {names.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
        {tab === 'llms' && <ConnectionManager generating={generating} onDirtyChange={setDirty} onBusyChange={setBusy} confirmDiscard={confirmDiscard} />}
        <div className="actions"><Button disabled={busy} onClick={close}>{t('shell.common.close')}</Button></div>
      </div>
    </Overlay>
    {dialog}
    </>
  )
}
