import { describe, expect, it } from 'vitest'
import { LlmProfileSchema, type LlmProfile } from '../../shared/settings'
import type { ConnectionSnapshot } from '../settings/requestSnapshot'
import { RefusalError, type chatCompletion } from './openai'
import { completeWithFallback } from './router'

const mainId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const nsfwId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
function settings(nsfwModel = 'n', mainModel = 'm'): ConnectionSnapshot {
  const captured = (id: string, baseUrl: string, model: string) => {
    const profile = LlmProfileSchema.parse({ baseUrl, model })
    return { id, parameters: profile, resolve: () => ({ ...profile }) }
  }
  return { main: captured(mainId, 'http://main/v1', mainModel), nsfw: captured(nsfwId, 'http://nsfw/v1', nsfwModel), language: 'en', languageInstruction: '', memoryRecall: 8, newsWebSearch: false }
}
const input = { system: 's', messages: [{ role: 'user' as const, content: 'hi' }] }

/** A stand-in for the LLM client that answers per model and records who was asked. */
function fake(answers: Record<string, string | Error>) {
  const asked: string[] = []
  const complete = (async (profile: LlmProfile) => {
    asked.push(profile.model)
    const answer = answers[profile.model]
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof chatCompletion
  return { complete, asked }
}

describe('completeWithFallback', () => {
  it('uses the Main LLM when it answers', async () => {
    const { complete, asked } = fake({ m: 'Hello.' })
    expect(await completeWithFallback(settings(), false, input, complete)).toEqual({
      reply: 'Hello.',
      profileId: mainId, profileRole: 'main'
    })
    expect(asked).toEqual(['m'])
  })

  it('goes straight to the NSFW LLM for a scene already marked NSFW', async () => {
    const { complete, asked } = fake({ n: 'Hello.' })
    expect((await completeWithFallback(settings(), true, input, complete)).profileRole).toBe('nsfw')
    expect(asked).toEqual(['n'])
  })

  it('switches to the NSFW LLM when the Main LLM refuses in its reply', async () => {
    const { complete, asked } = fake({ m: "I'm sorry, but I can't continue.", n: 'Come here.' })
    expect(await completeWithFallback(settings(), false, input, complete)).toEqual({
      reply: 'Come here.',
      profileId: nsfwId, profileRole: 'nsfw'
    })
    expect(asked).toEqual(['m', 'n'])
  })

  it('looks for a refusal after what the model thought to itself, and says why when nobody will write it', async () => {
    const thought = `<think>${'The user wants a love scene. '.repeat(12)}</think>I'm sorry, but I can't continue.`
    const { complete, asked } = fake({ m: thought, n: 'Come here.' })
    expect((await completeWithFallback(settings(), false, input, complete)).profileRole).toBe('nsfw')
    expect(asked).toEqual(['m', 'n'])
    // A character who thinks about refusing and then plays the scene has not refused.
    const played = fake({ m: "<think>I'm sorry, but should I? Yes.</think>She laughs." })
    expect((await completeWithFallback(settings(), false, input, played.complete)).profileRole).toBe('main')
    const both = fake({ m: new RefusalError('403 Forbidden'), n: 'I cannot write that.' })
    await expect(completeWithFallback(settings(), false, input, both.complete)).rejects.toThrow(/Main: The LLM declined to reply: 403 Forbidden\. NSFW: it answered "I cannot write that\."/)
  })

  it('switches when the endpoint itself blocks the request', async () => {
    const { complete } = fake({ m: new RefusalError('content filter'), n: 'Come here.' })
    expect((await completeWithFallback(settings(), false, input, complete)).profileRole).toBe('nsfw')
  })

  it('explains when there is no NSFW LLM to fall back to', async () => {
    const { complete } = fake({ m: 'I cannot write that.' })
    await expect(completeWithFallback(settings(''), false, input, complete)).rejects.toThrow(
      /no NSFW LLM is set up/
    )
  })

  it('reports when both decline, and passes other errors through', async () => {
    const both = fake({ m: 'I cannot write that.', n: 'I cannot write that.' })
    await expect(completeWithFallback(settings(), false, input, both.complete)).rejects.toThrow(
      /Both the Main LLM and the NSFW LLM declined/
    )
    const down = fake({ m: new Error('Could not reach http://main') })
    await expect(completeWithFallback(settings(), false, input, down.complete)).rejects.toThrow(
      'Could not reach http://main'
    )
    expect(down.asked).toEqual(['m'])
  })

  it('refuses to run with nothing configured', async () => {
    const { complete } = fake({})
    await expect(
      completeWithFallback(settings('', ''), false, input, complete)
    ).rejects.toThrow(/No LLM is configured/)
  })
})
