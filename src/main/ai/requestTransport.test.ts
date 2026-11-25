import { expect, it } from 'vitest'
import { LlmProfileSchema } from '../../shared/settings'
import { chatCompletion, listModels, RefusalError } from './openai'

it('retains connection parameters and credentials across tool rounds even if the caller edits its object', async () => {
  const profile = LlmProfileSchema.parse({ baseUrl: 'http://mock/v1', model: 'first', apiKey: 'first-key', temperature: 0.2, topK: 7, instructions: 'Original' })
  const requests: { model: string; key: string; temperature: number; top_k: number; system: string }[] = []
  const fetcher = (async (_url, init) => {
    const body = JSON.parse(init!.body as string)
    requests.push({ model: body.model, key: (init!.headers as Record<string, string>).Authorization, temperature: body.temperature, top_k: body.top_k, system: body.messages[0].content })
    return new Response(JSON.stringify({ choices: [{ message: requests.length === 1
      ? { tool_calls: [{ id: 'call1', function: { name: 'check', arguments: '{}' } }] }
      : { content: 'Hello.' }, finish_reason: 'stop' }] }))
  }) as typeof fetch
  await chatCompletion(profile, { system: 's', messages: [], languageInstruction: 'Captured language', tools: [{ name: 'check', description: 'Check', parameters: { type: 'object' }, run: () => {
    profile.apiKey = 'changed-key'; profile.model = 'changed'; profile.temperature = 1.9; profile.topK = 50; profile.instructions = 'Changed'
    return 'ok'
  } }] }, fetcher)
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  expect(requests[1]).toMatchObject({ model: 'first', key: 'Bearer first-key', temperature: 0.2, top_k: 7 })
  expect(requests[1].system).toContain('Captured language')
})

it('redacts known keys from provider errors while retaining refusal classification', async () => {
  const profile = LlmProfileSchema.parse({ baseUrl: 'https://mock/v1', model: 'a', apiKey: 'sensitive/key+value' })
  const failing = (async () => new Response(`content_filter ${profile.apiKey} ${encodeURIComponent(profile.apiKey)}`, { status: 403 })) as typeof fetch
  try {
    await chatCompletion(profile, { system: 's', messages: [] }, failing)
    throw new Error('Expected refusal')
  } catch (error) {
    expect(error).toBeInstanceOf(RefusalError)
    expect((error as Error).message).not.toContain(profile.apiKey)
    expect((error as Error).message).not.toContain(encodeURIComponent(profile.apiKey))
  }
  await expect(listModels(profile, failing)).rejects.not.toThrow(profile.apiKey)
})

it('does not cancel an independent request on the same endpoint', async () => {
  const profile = LlmProfileSchema.parse({ baseUrl: 'http://mock/v1', model: 'a', maxConcurrent: 1 })
  const stop = new AbortController()
  let release!: () => void
  const started = new Promise<void>((resolve) => { release = resolve })
  let sent = 0
  const fetcher = (async (_url, init) => {
    sent++
    if (sent === 1) {
      release()
      await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true }))
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Other reply' }, finish_reason: 'stop' }] }))
  }) as typeof fetch
  const first = chatCompletion(profile, { system: 's', messages: [], signal: stop.signal }, fetcher)
  await started
  const second = chatCompletion({ ...profile, model: 'other' }, { system: 's', messages: [] }, fetcher)
  const cancelled = expect(first).rejects.toThrow('Cancelled one')
  stop.abort(new Error('Cancelled one'))
  await cancelled
  expect(await second).toBe('Other reply')
})
