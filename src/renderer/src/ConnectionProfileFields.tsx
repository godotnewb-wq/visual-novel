import { useState } from 'react'
import {
  LLM_DEFAULT_TIMEOUT_SECONDS,
  LLM_MAX_TIMEOUT_SECONDS,
  LLM_MIN_TIMEOUT_SECONDS,
  REASONING_LEVELS,
  REASONING_STYLES,
  type LlmProfileView,
  type ReasoningLevel,
  type ReasoningStyle
} from '../../shared/settings'
import { t, type MessageKey } from '../../shared/i18n'
import { ModelField } from './ModelField'
import type { ProfileForm } from './connectionForm'

const SAMPLERS = [
  { field: 'topP', label: 'shell.settings.topP', min: 0, max: 1, step: 0.01 },
  { field: 'minP', label: 'shell.settings.minP', min: 0, max: 1, step: 0.01 },
  { field: 'topK', label: 'shell.settings.topK', min: 0, step: 1 },
  { field: 'repetitionPenalty', label: 'shell.settings.repetitionPenalty', min: 0, max: 3, step: 0.01 },
  { field: 'frequencyPenalty', label: 'shell.settings.frequencyPenalty', min: -2, max: 2, step: 0.05 },
  { field: 'presencePenalty', label: 'shell.settings.presencePenalty', min: -2, max: 2, step: 0.05 }
] as const satisfies readonly { field: keyof LlmProfileView; label: MessageKey; min: number; max?: number; step: number }[]

const REASONING_LABELS: Record<ReasoningLevel, MessageKey> = {
  default: 'shell.settings.reasoningDefault',
  off: 'shell.settings.reasoningOff',
  minimal: 'shell.settings.reasoningMinimal',
  low: 'shell.settings.reasoningLow',
  medium: 'shell.settings.reasoningMedium',
  high: 'shell.settings.reasoningHigh'
}
const STYLE_LABELS: Record<ReasoningStyle, MessageKey> = {
  auto: 'shell.settings.styleAuto',
  effort: 'shell.settings.styleEffort',
  openrouter: 'shell.settings.styleOpenRouter',
  template: 'shell.settings.styleTemplate'
}

/** A number that may be left blank, meaning the model's own. Held as typed, so that "0." is not lost on the way to "0.5". */
function OptionalNumber({ label, value, min, max, step, placeholder, title, onChange }: { label: string; value: number | undefined; min: number; max?: number; step: number; placeholder?: string; title?: string; onChange: (value: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  return (
    <label title={title}>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        placeholder={placeholder ?? t('shell.settings.modelDefault')}
        onChange={(e) => {
          setText(e.target.value)
          const read = Number(e.target.value)
          if (e.target.value.trim() === '') onChange(undefined)
          else if (Number.isFinite(read)) onChange(Math.min(max ?? read, Math.max(min, step === 1 ? Math.round(read) : read)))
        }}
        // What was kept, once the field is left: a number out of range is shown as the nearest it can be.
        onBlur={() => setText(value === undefined ? '' : String(value))}
      />
    </label>
  )
}

/** What a power user tunes: thinking, the samplers, and OpenRouter's choice of provider. Shut until opened. */
function AdvancedFields({ profile, onChange }: { profile: LlmProfileView; onChange: (patch: Partial<LlmProfileView>) => void }) {
  return (
    <details className="advanced">
      <summary>{t('shell.settings.advanced')}</summary>
      <div className="row">
        <label>
          {t('shell.settings.reasoning')}
          <select value={profile.reasoning} onChange={(e) => onChange({ reasoning: e.target.value as ReasoningLevel })}>
            {REASONING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(REASONING_LABELS[level])}
              </option>
            ))}
          </select>
        </label>
        <label title={t('shell.settings.reasoningStyleTitle')}>
          {t('shell.settings.reasoningStyle')}
          <select value={profile.reasoningStyle} disabled={profile.reasoning === 'default'} onChange={(e) => onChange({ reasoningStyle: e.target.value as ReasoningStyle })}>
            {REASONING_STYLES.map((style) => (
              <option key={style} value={style}>
                {t(STYLE_LABELS[style])}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sampler-grid">
        {SAMPLERS.map((sampler) => (
          <OptionalNumber
            key={sampler.field}
            label={t(sampler.label)}
            value={profile[sampler.field]}
            min={sampler.min}
            max={'max' in sampler ? sampler.max : undefined}
            step={sampler.step}
            onChange={(value) => onChange({ [sampler.field]: value })}
          />
        ))}
      </div>
      <OptionalNumber
        label={t('shell.settings.maxConcurrent')}
        title={t('shell.settings.maxConcurrentTitle')}
        placeholder={t('shell.settings.noLimit')}
        value={profile.maxConcurrent}
        min={1}
        step={1}
        onChange={(value) => onChange({ maxConcurrent: value })}
      />
      <span className="field-label">{t('shell.settings.openRouter')}</span>
      <label>
        {t('shell.settings.providerOrder')}
        <input value={profile.providerOrder} placeholder="Anthropic, Together" onChange={(e) => onChange({ providerOrder: e.target.value })} />
      </label>
      <label>
        {t('shell.settings.providerIgnore')}
        <input value={profile.providerIgnore} onChange={(e) => onChange({ providerIgnore: e.target.value })} />
      </label>
      <label className="inline">
        <input type="checkbox" checked={profile.allowFallbacks} onChange={(e) => onChange({ allowFallbacks: e.target.checked })} />
        {t('shell.settings.allowFallbacks')}
      </label>
    </details>
  )
}

export function ConnectionProfileFields({ profile: p, onChange }: { profile: ProfileForm; onChange: (patch: Partial<ProfileForm>) => void }) {
  return <>
    <label>
      {t('shell.settings.baseUrl')}
      <input
        value={p.baseUrl}
        onChange={(e) => onChange({ baseUrl: e.target.value })}
        placeholder="https://api.openai.com/v1"
      />
    </label>
    <label>
      {t('shell.settings.apiKey')}
      <input
        type="password"
        value={p.apiKeyInput}
        disabled={p.clearKey}
        onChange={(e) => onChange({ apiKeyInput: e.target.value })}
        placeholder={p.hasApiKey ? t('shell.settings.keySaved') : t('shell.settings.keyOptional')}
      />
    </label>
    {p.hasApiKey && (
      <label className="inline">
        <input
          type="checkbox"
          checked={p.clearKey}
          onChange={(e) => onChange({ clearKey: e.target.checked })}
        />
        {t('shell.settings.removeKey')}
      </label>
    )}
    <ModelField
      profileId={p.profileId}
      baseUrl={p.baseUrl}
      apiKey={p.clearKey ? '' : p.apiKeyInput || undefined}
      value={p.model}
      onChange={(model) => onChange({ model })}
    />
    <label>
      {t('shell.settings.temperature')}
      <input
        type="number"
        min={0}
        max={2}
        step={0.05}
        value={p.temperature}
        onChange={(e) => onChange({ temperature: e.target.valueAsNumber || 0 })}
      />
    </label>
    <label>
      {t('shell.settings.maxTokens')}
      <input
        type="number"
        min={1}
        step={1}
        value={p.maxTokens}
        onChange={(e) => onChange({ maxTokens: Math.max(1, Math.round(e.target.valueAsNumber || 1)) })}
      />
    </label>
    <label>
      {t('shell.settings.timeout')}
      <input
        type="number"
        min={LLM_MIN_TIMEOUT_SECONDS}
        max={LLM_MAX_TIMEOUT_SECONDS}
        step={1}
        value={p.timeoutSeconds}
        onChange={(e) => onChange({ timeoutSeconds: Math.round(e.target.valueAsNumber || LLM_DEFAULT_TIMEOUT_SECONDS) })}
        onBlur={() => onChange({ timeoutSeconds: Math.min(LLM_MAX_TIMEOUT_SECONDS, Math.max(LLM_MIN_TIMEOUT_SECONDS, p.timeoutSeconds)) })}
      />
    </label>
    <label>
      {t('shell.settings.instructions')}
      <textarea
        rows={3}
        value={p.instructions}
        onChange={(e) => onChange({ instructions: e.target.value })}
        placeholder={t('shell.settings.instructionsPlaceholder')}
      />
    </label>
    <AdvancedFields profile={p} onChange={(patch) => onChange(patch)} />
  </>
}
