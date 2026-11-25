import type { IpcMainInvokeEvent, WebContents } from 'electron'

export function trustedConnectionSender(event: IpcMainInvokeEvent, owner: WebContents | undefined, expectedUrl: string): boolean {
  try {
    if (!owner || owner.isDestroyed() || event.sender !== owner || event.senderFrame !== owner.mainFrame) return false
    const actual = new URL(event.senderFrame.url)
    const expected = new URL(expectedUrl)
    actual.hash = ''
    expected.hash = ''
    return actual.href === expected.href
  } catch { return false }
}
