import { useState } from 'react'
import { assignedConnection, connectionSettings } from './connectionForm'

/**
 * The model a line he sends goes to, for the tooltip on a Send button: read as the pointer comes onto it, so that a change
 * in the settings shows. An NSFW scene's goes to the NSFW LLM where one is set up, everything else to the Main LLM.
 */
export function useModelName(nsfw = false): { model: string; look: () => void } {
  const [model, setModel] = useState('')
  const look = () => {
    window.api.connections.get().then((result) => setModel(assignedConnection(connectionSettings(result), nsfw)?.model ?? '')).catch(() => setModel(''))
  }
  return { model, look }
}
