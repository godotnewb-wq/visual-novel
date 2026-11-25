import type { LlmProfile } from '../../shared/settings'

export interface CapturedConnection {
  readonly id: string
  readonly parameters: Readonly<Omit<LlmProfile, 'apiKey'>>
  resolve(): LlmProfile
}

export interface ConnectionSnapshot {
  readonly main: CapturedConnection
  readonly nsfw: CapturedConnection | null
  readonly language: string
  readonly memoryRecall: number
  readonly newsWebSearch: boolean
  readonly languageInstruction: string
}
