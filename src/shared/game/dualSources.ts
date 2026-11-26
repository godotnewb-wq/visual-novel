import type { DualValidationContext, DualSource } from './dualTurnValidation'
import { sceneCast } from './scene'
import { witnessedAt } from './encounterNotes'

/** Old messages without a recorded audience may supply reference context, but do not acquire new witnesses. */
export function dualSceneSources(context: Omit<DualValidationContext, 'sources'>): DualSource[] {
  const { scene } = context, last = scene.messages.length - 1
  return scene.messages.flatMap((message, messageIndex): DualSource[] => {
    const current = messageIndex === last && message.role === 'user'
    if (!current && messageIndex < last - 6) return []
    return [{ id: current ? 'player' : `history:${messageIndex}`, kind: current ? 'player' : 'history',
      currentTurn: current, text: message.content, speaker: message.role === 'user' ? { kind: 'player' } : null,
      witnessIds: current ? sceneCast(scene) : witnessedAt(scene, messageIndex), messageIndex, messageRange: { start: 0, end: message.content.length },
      turnId: scene.generation?.mode === 'dual' ? scene.generation.turnHistory?.find((turn) => turn.fromMessage <= messageIndex && messageIndex < turn.toMessage)?.turnId : undefined }]
  })
}
