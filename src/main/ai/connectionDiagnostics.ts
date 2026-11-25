import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { ListConnectionModelsSchema, TestConnectionSchema } from '../../shared/llmConnections'
import { IPC } from '../../shared/ipc'
import { isConfigured } from '../../shared/settings'
import { t } from '../../shared/i18n'
import { ConnectionStoreError } from '../settings/connectionErrors'
import type { ConnectionStore } from '../settings/connectionStore'
import { chatCompletion, listModels } from './openai'

export function registerConnectionDiagnostics(
  ipc: Pick<IpcMain, 'handle'>,
  store: ConnectionStore,
  allowedSender: (event: IpcMainInvokeEvent) => boolean,
  client = { listModels, chatCompletion }
): void {
  ipc.handle(IPC.connectionsModels, async (event, raw: unknown, ...extra: unknown[]) => {
    try {
      if (!allowedSender(event)) throw new ConnectionStoreError('forbidden')
      const parsed = ListConnectionModelsSchema.safeParse(raw)
      if (!parsed.success || extra.length) throw new ConnectionStoreError('invalid-request')
      const { profileId, baseUrl, apiKey } = parsed.data
      const key = store.draftKey(profileId, baseUrl, apiKey)
      return { models: await client.listModels({ baseUrl, apiKey: key }) }
    } catch (error) {
      return { models: [], error: error instanceof ConnectionStoreError ? new ConnectionStoreError(error.code).message : t('llm.connections.discoveryFailed') }
    }
  })
  ipc.handle(IPC.connectionsTest, async (event, raw: unknown, ...extra: unknown[]) => {
    try {
      if (!allowedSender(event)) throw new ConnectionStoreError('forbidden')
      const parsed = TestConnectionSchema.safeParse(raw)
      if (!parsed.success || extra.length) throw new ConnectionStoreError('invalid-request')
      const { profileId, profile } = parsed.data
      if (!isConfigured(profile)) return { ok: false, message: t('llm.main.urlAndModel') }
      const key = store.draftKey(profileId, profile.baseUrl, profile.apiKey)
      await client.chatCompletion({ ...profile, apiKey: key }, {
        system: t('llm.main.testSystem'), messages: [{ role: 'user', content: t('llm.main.testUser') }],
        maxTokens: 16, temperature: 0
      })
      return { ok: true, message: t('llm.connections.testSucceeded') }
    } catch (error) {
      return { ok: false, message: error instanceof ConnectionStoreError ? new ConnectionStoreError(error.code).message : t('llm.connections.testFailed') }
    }
  })
}
