import { describe, expect, it, vi } from 'vitest'
import { LlmProfileSchema } from '../../shared/settings'
import { RefusalError } from './openai'
import { singleCompletion, type SingleCompletionInput } from './singleCompletion'

const profile = () => LlmProfileSchema.parse({ baseUrl: 'http://mock-single/v1/', model: 'manager', apiKey: 'private-key', temperature: 0, maxConcurrent: 1 })
const input = (): SingleCompletionInput => ({ system: 'Manager', languageInstruction: 'English', messages: [{ role: 'user', content: 'Evidence' }] })
const response = (message: object, finish_reason = 'stop', extra = {}) => new Response(JSON.stringify({ choices: [{ message, finish_reason }], ...extra }))
const format = { type: 'json_schema' as const, json_schema: { name: 'test', strict: true as const, schema: { type: 'object' } } }

describe('one-attempt completion transport', () => {
  it('returns raw Manager text and usage without tools, cleanup, or prose refusal detection', async () => {
    const raw = '{"quote":"[COMFORT: 4] I cannot continue", "reason":"<think>evidence</think>"}'
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ content: raw }, 'stop', { usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 } }))
    expect(await singleCompletion(profile(), input(), fetcher)).toEqual({ content: raw, usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 } })
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string)
    expect(body).toMatchObject({ model: 'manager', temperature: 0, messages: [{ role: 'system', content: 'Manager\n\nEnglish' }, { role: 'user', content: 'Evidence' }] })
    expect(body.tools).toBeUndefined(); expect(body.response_format).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([
    [{ content: 'partial' }, 'length', 'truncated'],
    [{ content: 'partial' }, 'max_tokens', 'truncated'],
    [{ content: 'partial' }, 'max_output_tokens', 'truncated'],
    [{ content: '' }, 'stop', 'empty'],
    [{ content: null }, 'stop', 'invalid-response'],
    [{ content: 'text', tool_calls: [{}] }, 'stop', 'tool-output'],
    [{ content: 'text', tool_calls: 'bad' }, 'stop', 'tool-output'],
    [{ content: 'text', function_call: {} }, 'stop', 'tool-output'],
    [{ content: 'text' }, 'tool_calls', 'tool-output']
  ] as const)('rejects unusable completion %j', async (message, finish, code) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(message, finish))
    await expect(singleCompletion(profile(), input(), fetcher)).rejects.toMatchObject({ code })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each(['content_filter', 'safety', 'refusal', 'blocked', 'moderation'])('handles explicit provider refusal: %s', async (finish) => {
    await expect(singleCompletion(profile(), input(), vi.fn<typeof fetch>().mockResolvedValue(response({ content: 'text' }, finish)))).rejects.toBeInstanceOf(RefusalError)
  })
  it('handles refusal metadata and malformed JSON envelopes', async () => {
    await expect(singleCompletion(profile(), input(), vi.fn<typeof fetch>().mockResolvedValue(response({ content: 'text', refusal: 'No' })))).rejects.toBeInstanceOf(RefusalError)
    for (const data of [{ choices: [] }, {}, { choices: [null] }]) {
      await expect(singleCompletion(profile(), input(), vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data))))).rejects.toMatchObject({ code: 'invalid-response' })
    }
  })
  it('recognizes explicit unsupported format, without making a fallback request itself', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('response_format json_schema is not supported', { status: 400 }))
    await expect(singleCompletion(profile(), { ...input(), responseFormat: format }, fetcher)).rejects.toMatchObject({ code: 'format-unsupported' })
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).response_format).toEqual(format)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([401, 403, 429, 500])('does not misclassify an HTTP %s as format incompatibility', async (status) => {
    await expect(singleCompletion(profile(), { ...input(), responseFormat: format }, vi.fn<typeof fetch>().mockResolvedValue(new Response('json_schema unsupported private-key', { status })))).rejects.not.toMatchObject({ code: 'format-unsupported' })
  })
  it('redacts provider errors and never retries transport failures', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('failed private-key'))
    await expect(singleCompletion(profile(), input(), fetcher)).rejects.toThrow('failed [redacted]')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rejects an expired request even if an injected transport ignores abort', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(response({ content: 'Late' })), 15)))
    await expect(singleCompletion(profile(), { ...input(), timeoutMs: 1 }, fetcher)).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('captures body, key, timeout, and caller signal before waiting in an endpoint queue', async () => {
    let release!: (reply: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { release = resolve })).mockResolvedValue(response({ content: 'Second' }))
    const first = singleCompletion(profile(), input(), fetcher)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const connection = profile(), request = input(), controller = new AbortController()
    request.signal = controller.signal
    const second = singleCompletion(connection, request, fetcher)
    connection.apiKey = 'changed'; connection.model = 'changed'; request.system = 'changed'; request.messages[0].content = 'changed'; request.timeoutMs = 0; request.signal = AbortSignal.abort()
    release(response({ content: 'First' }))
    await first
    expect(await second).toEqual({ content: 'Second' })
    const sent = fetcher.mock.calls[1][1]!
    expect((sent.headers as Record<string, string>).Authorization).toBe('Bearer private-key')
    expect(JSON.parse(sent.body as string)).toMatchObject({ model: 'manager', messages: [{ content: 'Manager\n\nEnglish' }, { content: 'Evidence' }] })
  })
  it('cancels a queued call without sending it or affecting the active one', async () => {
    let release!: (reply: Response) => void
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const first = singleCompletion(profile(), input(), fetcher)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const controller = new AbortController()
    const second = singleCompletion(profile(), { ...input(), signal: controller.signal }, fetcher)
    const rejection = expect(second).rejects.toMatchObject({ code: 'cancelled' })
    controller.abort(); await rejection
    release(response({ content: 'Still running' }))
    expect(await first).toEqual({ content: 'Still running' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
