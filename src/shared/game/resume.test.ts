import { expect, it } from 'vitest'
import { SceneSchema } from '../model'
import { SaveDataSchema, type SaveData } from '../saves'
import { resumeSavedGame } from './resume'
import { sceneBaseline } from './scene'
import { createInitialState } from './state'
import { fixture } from './testFixture'
import { packTurns, rewound, unpackTurns, type Turn } from './turns'

const content = fixture()

function savedConversation(): SaveData {
  let state = createInitialState(content)
  let scene = SceneSchema.parse({ loveInterestId: 'ana', companionIds: [], npc: false, nsfw: false,
    beats: [{ activityName: 'Conversation', locationName: 'Home' }], messages: [{ role: 'assistant', content: 'Hello.' }],
    gifts: [], conceived: [], departed: [], baseline: sceneBaseline(state, 'ana', []) })
  const turns: Turn[] = []
  for (let number = 1; number <= 6; number++) {
    const text = `Test input ${number}`
    turns.push({ state, scene, text })
    state = { ...state, time: state.time + 1, player: { ...state.player, money: state.player.money + number } }
    scene = { ...scene, messages: [...scene.messages, { role: 'user', content: text }, { role: 'assistant', content: 'Hello.' }] }
  }
  return SaveDataSchema.parse(JSON.parse(JSON.stringify({ state, scene, turns: packTurns(turns, state, scene) })))
}

it('carries six saved undo records through session loading and a seventh reply without losing their snapshots', () => {
  const saved = savedConversation()
  const original = JSON.stringify(saved)
  const loaded = resumeSavedGame(content, saved)
  expect(loaded.turns).toHaveLength(6)
  expect(loaded.scene?.messages).toHaveLength(13)
  const kept = unpackTurns(loaded.turns!, loaded.state, loaded.scene!)
  expect(kept.map((turn) => turn.text)).toEqual(saved.turns!.map((turn) => turn.text))
  const seventh: Turn = { state: loaded.state, scene: loaded.scene!, text: 'Test input 7' }
  const state = { ...loaded.state, player: { ...loaded.state.player, money: loaded.state.player.money + 7 } }
  const scene = { ...loaded.scene!, messages: [...loaded.scene!.messages, { role: 'user' as const, content: seventh.text }, { role: 'assistant' as const, content: 'Hello.' }] }
  const written = SaveDataSchema.parse(JSON.parse(JSON.stringify({ state, scene, turns: packTurns([...kept, seventh], state, scene) })))
  const restarted = resumeSavedGame(content, written)
  const restored = unpackTurns(restarted.turns!, restarted.state, restarted.scene!)
  expect(restored).toHaveLength(7)
  expect(restored.slice(0, 6)).toEqual(kept)
  expect(restored[6]).toEqual(seventh)
  expect(rewound(restored[6], restarted.state)).toEqual(loaded.state)
  expect(JSON.stringify(saved)).toBe(original)
})

it.each(['primary', 'companion'])('clears undo records when a missing %s prevents resuming the scene', (missing) => {
  const saved = savedConversation()
  if (missing === 'primary') saved.scene!.loveInterestId = 'removed-character'
  else saved.scene!.companionIds = ['removed-character']
  const loaded = resumeSavedGame(content, saved)
  expect(loaded.scene).toBeNull()
  expect(loaded.turns).toBeUndefined()
  expect(loaded.state.player.name).toBe(saved.state.player.name)
  expect(saved.turns).toHaveLength(6)
})

it('does not attach orphaned undo records to a save without an open scene', () => {
  const saved = savedConversation()
  saved.scene = null
  expect(resumeSavedGame(content, saved)).toMatchObject({ scene: null, turns: undefined })
})

it('still loads an older valid scene without saved undo records', () => {
  const saved = savedConversation()
  delete saved.turns
  const loaded = resumeSavedGame(content, saved)
  expect(loaded.scene).toEqual(saved.scene)
  expect(loaded.turns).toBeUndefined()
  expect(unpackTurns(loaded.turns ?? [], loaded.state, loaded.scene!)).toEqual([])
})
