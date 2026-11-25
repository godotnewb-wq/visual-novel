import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { expect, it } from 'vitest'
import { trustedConnectionSender } from './trustedSender'

it('requires the owning main frame and exact trusted URL, allowing only hash navigation', () => {
  const frame = { url: 'http://localhost:5173/#preview=x' }
  const owner = { isDestroyed: () => false, mainFrame: frame } as unknown as WebContents
  const event = { sender: owner, senderFrame: frame } as IpcMainInvokeEvent
  expect(trustedConnectionSender(event, owner, 'http://localhost:5173/')).toBe(true)
  for (const url of ['https://other/', 'http://localhost:5173/other', 'http://localhost:5173/?other=1']) {
    frame.url = url
    expect(trustedConnectionSender(event, owner, 'http://localhost:5173/')).toBe(false)
  }
  frame.url = 'file:///D:/game/out/renderer/index.html#menu'
  expect(trustedConnectionSender(event, owner, 'file:///D:/game/out/renderer/index.html')).toBe(true)
  expect(trustedConnectionSender({ ...event, senderFrame: {} } as IpcMainInvokeEvent, owner, frame.url)).toBe(false)
  expect(trustedConnectionSender(event, undefined, frame.url)).toBe(false)
})
