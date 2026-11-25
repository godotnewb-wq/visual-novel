import type { ContentPack } from '../model'
import type { SaveData } from '../saves'
import { withNpc } from './npcs'
import { sceneCast } from './scene'
import { reconcileState } from './state'

export function resumeSavedGame(content: ContentPack, saved: SaveData): SaveData {
  const scene = saved.scene && sceneCast(saved.scene).every((id) => withNpc(content, id).loveInterests.some((li) => li.id === id))
    ? saved.scene
    : null
  return {
    state: reconcileState(saved.state, content),
    scene,
    // Undo records belong to this scene; they cannot follow a scene that no longer exists.
    turns: scene ? saved.turns : undefined
  }
}
