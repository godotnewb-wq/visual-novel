import { describe, expect, it } from 'vitest'
import type { Scene } from '../../shared/model'
import { LlmProfileSchema } from '../../shared/settings'
import { buildCharacterPrompt } from '../../shared/game/prompt'
import { dialogueLines, parseDirectives, sceneBaseline } from '../../shared/game/scene'
import { findDestination, movedScene, moveState, passSceneTime, sceneDestinations } from '../../shared/game/sceneMoves'
import { createInitialState } from '../../shared/game/state'
import { fixture } from '../../shared/game/testFixture'
import { chatCompletion } from './openai'
import { completeWithFallback } from './router'
import { moveTool } from './tools'
import baseline from './fixtures/transitionBaseline.json'

// Preserve the legacy comparison, including known synthetic leaks, until Dual-call has its own contract.
describe('P2.0 synthetic legacy transition baseline', () => {
  it.each(baseline.scenarios)('$id', async (scenario) => {
    const content = fixture()
    const state = createInitialState(content)
    const scene: Scene = {
      loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false,
      beats: [{ activityName: 'Tea', locationName: 'Home' }], messages: [],
      gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana')
    }
    const original = structuredClone({ state, scene })
    const moves: { destinationId: string; hours: number; staying: string[] }[] = []
    const tool = moveTool(content, state, scene, (destination, hours, staying) => {
      moves.push({ destinationId: destination.id, hours, staying })
    })!
    const requests: { messages: { role: string; content: unknown }[]; tools?: unknown[] }[] = []
    const fetcher = (async (_url, init) => {
      requests.push(JSON.parse(init!.body as string))
      const message = scenario.responses[requests.length - 1]
      expect(message, 'Unexpected extra transport round').toBeDefined()
      if ('status' in message && typeof message.status === 'number') return new Response(message.error, { status: message.status })
      return new Response(JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }))
    }) as typeof fetch
    const profile = LlmProfileSchema.parse({ baseUrl: 'http://transition-baseline.invalid/v1', model: 'mock' })
    const reply = await completeWithFallback({
      main: { id: 'synthetic-main', parameters: profile, resolve: () => profile }, nsfw: null,
      language: 'en', languageInstruction: '', memoryRecall: 8, newsWebSearch: false
    }, false, { system: buildCharacterPrompt({ content, state, loveInterestId: 'ana', sceneBeats: scene.beats }), messages: [], tools: [tool] },
    (captured, input) => chatCompletion(captured, input, fetcher))
    const parsed = parseDirectives(reply.reply)
    const displayed = dialogueLines(parsed.text)
    const visible = displayed.map((line) => line.text).join('\n')

    expect(parsed.text).toBe(scenario.visibleText)
    expect(visible).toBe(scenario.visibleText)
    expect(/move_scene|\[MOVE:/i.test(visible)).toBe(scenario.commandVisible)
    expect(requests).toHaveLength(scenario.responses.length)
    expect(reply.profileRole).toBe('main')
    expect(parsed.ended).toBe(false)
    expect(moves).toHaveLength(scenario.moveTo ? 1 : 0)
    expect(moves[0]?.destinationId ?? null).toBe(scenario.moveTo)
    expect({ state, scene }).toEqual(original)
    if (scenario.id === 'tools-rejected-then-curly-command') {
      expect(requests[0].tools).toHaveLength(1)
      expect(requests[1].tools).toBeUndefined()
      expect(requests[1].messages[0].content).toContain('move_scene')
    }

    let committed = { state, scene }
    if (moves[0]) {
      const move = moves[0]
      const destination = findDestination(sceneDestinations(content, state, scene), move.destinationId)!
      committed = {
        state: passSceneTime(content, moveState(state, destination), move.hours),
        scene: movedScene(scene, destination)
      }
      expect(requests[1].messages.some((message) => message.role === 'tool')).toBe(true)
    }
    expect(committed.state.locationId).toBe(scenario.moveTo ?? original.state.locationId)
    expect(committed.state.time).toBe(original.state.time)
    expect(committed.scene.beats).toHaveLength(scenario.moveTo ? 2 : 1)
  })
})
