import { t, type MessageKey } from '../../shared/i18n'
import type { ConnectionErrorCode } from '../../shared/llmConnections'

const messages: Record<ConnectionErrorCode, MessageKey> = {
  'invalid-request': 'llm.connections.invalidRequest',
  'invalid-settings': 'llm.connections.invalidSettings',
  'read-failed': 'llm.connections.readFailed',
  'write-failed': 'llm.connections.writeFailed',
  'backup-failed': 'llm.connections.backupFailed',
  'settings-changed': 'llm.connections.settingsChanged',
  'profile-not-found': 'llm.connections.profileNotFound',
  'profile-assigned': 'llm.connections.profileAssigned',
  'encryption-unavailable': 'llm.connections.encryptionUnavailable',
  'credential-unavailable': 'llm.connections.credentialUnavailable',
  'endpoint-key-required': 'llm.connections.endpointKeyRequired',
  forbidden: 'llm.connections.forbidden',
  'internal-error': 'llm.connections.internalError'
}

/** Filesystem, cipher, and validation exceptions can contain secrets; only these messages cross IPC. */
export class ConnectionStoreError extends Error {
  constructor(readonly code: ConnectionErrorCode) {
    super(t(messages[code]))
    this.name = 'ConnectionStoreError'
  }
}
