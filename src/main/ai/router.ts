import { plainTags } from '../../shared/game/scene'
import { looksLikeRefusal } from '../../shared/game/refusal'
import { isConfigured, type LlmProfile } from '../../shared/settings'
import type { ConnectionRole } from '../../shared/llmConnections'
import type { ConnectionSnapshot } from '../settings/requestSnapshot'
import { t } from '../../shared/i18n'
import { chatCompletion, RefusalError, type CompletionInput } from './openai'

/** What the player is told when there is no LLM to ask. */
export const notConfigured = (): string => t('llm.router.notConfigured')

export interface RoutedReply {
  reply: string
  /** Which LLM produced the reply. */
  profileId: string
  profileRole: ConnectionRole
}

// What a model thought to itself before answering is not the answer: a refusal is looked for in what comes after it.
const THINKING = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi

/** Returns the reply, or why there is none when the model or its endpoint declined to write one. */
async function attempt(
  complete: typeof chatCompletion,
  profile: LlmProfile,
  input: CompletionInput
): Promise<{ reply: string } | { declined: string }> {
  try {
    const reply = await complete(profile, input)
    const said = reply.replace(THINKING, '').replace(/^[\s\S]*<\/think(?:ing)?>/i, '').trim()
    // Its hidden lines and speaker names in plain ASCII, however the language it wrote in punctuates: see `plainTags`.
    return looksLikeRefusal(said) ? { declined: t('llm.router.answered', { said: said.slice(0, 120) }) } : { reply: plainTags(reply) }
  } catch (error) {
    if (error instanceof RefusalError) return { declined: error.message }
    throw error
  }
}

/**
 * Sends a request to the Main LLM, or straight to the NSFW LLM for a scene already
 * marked NSFW. If the Main LLM declines, the NSFW LLM takes over.
 */
export async function completeWithFallback(
  settings: ConnectionSnapshot,
  nsfw: boolean,
  input: CompletionInput,
  complete: typeof chatCompletion = chatCompletion
): Promise<RoutedReply> {
  const first = nsfw && settings.nsfw && isConfigured(settings.nsfw.parameters) ? 'nsfw' : 'main'
  const selected = settings[first]!
  if (!isConfigured(selected.parameters)) throw new Error(notConfigured())
  const captured = { ...input, languageInstruction: settings.languageInstruction }

  const tried = await attempt(complete, selected.resolve(), captured)
  if ('reply' in tried) return { reply: tried.reply, profileId: selected.id, profileRole: first }

  if (first === 'nsfw') throw new Error(t('llm.router.nsfwDeclined', { why: tried.declined }))
  if (!settings.nsfw || !isConfigured(settings.nsfw.parameters)) {
    throw new Error(t('llm.router.noFallback', { why: tried.declined }))
  }
  const second = await attempt(complete, settings.nsfw.resolve(), captured)
  if ('declined' in second) {
    throw new Error(t('llm.router.bothDeclined', { main: tried.declined, nsfw: second.declined }))
  }
  return { reply: second.reply, profileId: settings.nsfw.id, profileRole: 'nsfw' }
}
