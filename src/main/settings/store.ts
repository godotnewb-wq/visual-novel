/** Encrypts API keys at rest. Backed by Electron's safeStorage in the app. */
export interface KeyCipher {
  encrypt(plain: string): string
  decrypt(stored: string): string
}
