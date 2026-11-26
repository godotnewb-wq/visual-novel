import type { LlmProfile } from '../../shared/settings'
import { t } from '../../shared/i18n'
import { extraParameters, isRefusalResponse, RefusalError, type CompletionInput } from './openai'
import { inTurn } from './queue'
import { redactConnectionDetail } from './redact'

export interface ManagerResponseFormat {
  type: 'json_schema'
  json_schema: { name: string; strict: true; schema: Record<string, unknown> }
}
export type SingleCompletionInput = Omit<CompletionInput, 'tools'> & { responseFormat?: ManagerResponseFormat }
export interface CompletionUsage { promptTokens?: number; completionTokens?: number; totalTokens?: number }
export interface SingleCompletion { content: string; usage?: CompletionUsage }
export class SingleCompletionError extends Error {
  constructor(readonly code: 'format-unsupported' | 'tool-output' | 'truncated' | 'empty' | 'invalid-response' | 'cancelled') {
    super(code)
    this.name = 'SingleCompletionError'
  }
}

/** Exactly one transport attempt, with no executable tools, prose cleanup, or implicit retries. */
export async function singleCompletion(profile: LlmProfile, input: SingleCompletionInput, fetcher: typeof fetch = fetch): Promise<SingleCompletion> {
  const captured = { ...profile }
  const { signal: callerSignal, timeoutMs, responseFormat } = input
  const url = `${captured.baseUrl.trim().replace(/\/+$/, '')}/chat/completions`
  const body = JSON.stringify({
    ...extraParameters(captured), model: captured.model,
    messages: [{ role: 'system', content: [input.system, input.languageInstruction ?? t('core.llm.writeIn'), captured.instructions].filter(Boolean).join('\n\n') },
      ...input.messages.map((message) => ({ role: message.role, content: message.content }))],
    temperature: input.temperature ?? captured.temperature, max_tokens: input.maxTokens ?? captured.maxTokens,
    ...(input.responseFormat && { response_format: input.responseFormat })
  })
  const headers = { 'Content-Type': 'application/json', ...(captured.apiKey && { Authorization: `Bearer ${captured.apiKey}` }) }
  try {
    callerSignal?.throwIfAborted()
    return await inTurn(url, captured.maxConcurrent, callerSignal, async () => {
      callerSignal?.throwIfAborted()
      const timeout = AbortSignal.timeout(timeoutMs ?? captured.timeoutSeconds * 1000)
      const signal = callerSignal ? AbortSignal.any([timeout, callerSignal]) : timeout
      const checkActive = () => {
        callerSignal?.throwIfAborted()
        if (timeout.aborted) throw new Error(t('llm.openai.tooLong'))
      }
      let response: Response
      try { response = await fetcher(url, { method: 'POST', headers, body, signal }) } catch (error) {
        if (timeout.aborted) throw new Error(t('llm.openai.tooLong'))
        throw error
      }
      checkActive()
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 300)
        if (isRefusalResponse(response.status, detail)) throw new RefusalError(`${response.status}: ${detail}`)
        if (responseFormat && [400, 422].includes(response.status)
          && /response_format|json_schema/i.test(detail) && /unsupported|not supported|unrecognized|unknown parameter|not implemented/i.test(detail)) {
          throw new SingleCompletionError('format-unsupported')
        }
        throw new Error(t('llm.openai.failed', { status: response.status, statusText: response.statusText, body: detail }))
      }
      const data: unknown = await response.json()
      checkActive()
      if (!data || typeof data !== 'object' || !('choices' in data) || !Array.isArray(data.choices)) throw new SingleCompletionError('invalid-response')
      const choice = data.choices[0]
      if (!choice || typeof choice !== 'object' || !choice.message || typeof choice.message !== 'object') throw new SingleCompletionError('invalid-response')
      const message = choice.message
      const finishes = [choice.finish_reason, choice.native_finish_reason].filter((value): value is string => typeof value === 'string').map((value) => value.toLowerCase())
      if (finishes.some((value) => ['content_filter', 'safety', 'refusal', 'blocked', 'moderation'].includes(value))
        || typeof message.refusal === 'string' && message.refusal.length > 0) throw new RefusalError('Provider refused the request.')
      if (finishes.some((value) => ['length', 'max_tokens', 'max_output_tokens'].includes(value))) throw new SingleCompletionError('truncated')
      if (finishes.some((value) => ['tool_calls', 'function_call'].includes(value)) || message.function_call
        || message.tool_calls !== undefined && (!Array.isArray(message.tool_calls) || message.tool_calls.length > 0)) throw new SingleCompletionError('tool-output')
      if (typeof message.content !== 'string') throw new SingleCompletionError('invalid-response')
      if (!message.content.trim()) throw new SingleCompletionError('empty')
      const usage: CompletionUsage = {}
      const rawUsage = 'usage' in data && data.usage && typeof data.usage === 'object' ? data.usage as Record<string, unknown> : {}
      for (const [key, field] of [['promptTokens', 'prompt_tokens'], ['completionTokens', 'completion_tokens'], ['totalTokens', 'total_tokens']] as const) {
        const value = rawUsage[field]
        if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) usage[key] = value
      }
      return { content: message.content, ...(Object.keys(usage).length > 0 && { usage }) }
    })
  } catch (error) {
    if (callerSignal?.aborted) throw new SingleCompletionError('cancelled')
    if (error instanceof SingleCompletionError) throw error
    const detail = redactConnectionDetail(error instanceof Error ? error.message : String(error), captured)
    if (error instanceof RefusalError) throw new RefusalError(detail)
    throw new Error(detail)
  }
}
