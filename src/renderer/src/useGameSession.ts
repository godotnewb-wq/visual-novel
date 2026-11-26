import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import type { GameState, Scene } from '../../shared/model'
import type { SaveData } from '../../shared/saves'
import type { Turn } from '../../shared/game/turns'
import { createGameSession, reduceGameSession, type GameSession, type SessionAction } from '../../shared/game/dualSession'
import { initialiseSceneGeneration } from '../../shared/game/encounterNotes'
import { GENERATION_CHANGED } from './generationSettings'

/** The ref rejects competing async completions immediately; React receives one complete session per dispatch. */
export function useGameSession(initial: SaveData, mode: 'legacy' | 'dual' = 'legacy') {
  const preferredMode = useRef(mode)
  preferredMode.current = mode
  useEffect(() => {
    const changed = (event: Event) => { const value = (event as CustomEvent).detail; if (value === 'legacy' || value === 'dual') preferredMode.current = value }
    window.addEventListener(GENERATION_CHANGED, changed)
    return () => window.removeEventListener(GENERATION_CHANGED, changed)
  }, [])
  const current = useRef<GameSession | null>(null)
  if (current.current === null) {
    const restored = createGameSession(initial)
    // Missing metadata on an older saved scene or undo record always means Legacy, regardless of the new-scene preference.
    restored.scene = restored.scene && initialiseSceneGeneration(restored.scene, 'legacy', '')
    restored.turns = restored.turns.map((turn) => ({ ...turn, scene: initialiseSceneGeneration(turn.scene, 'legacy', '') }))
    current.current = restored
  }
  const [session, setSession] = useState(current.current)
  const dispatch = useCallback((action: SessionAction) => {
    const next = reduceGameSession(current.current!, action)
    if (next !== current.current) { current.current = next; setSession(next) }
    return next
  }, [])
  const getSession = useCallback(() => current.current!, [])
  const setState = useCallback((value: SetStateAction<GameState>) => { dispatch({ type: 'set', field: 'state', value }) }, [dispatch])
  const setScene = useCallback((value: SetStateAction<Scene | null>) => {
    dispatch({ type: 'set', field: 'scene', value: (before) => {
      const next = typeof value === 'function' ? value(before) : value
      return next && !next.generation ? initialiseSceneGeneration(next, preferredMode.current, crypto.randomUUID()) : next
    } })
  }, [dispatch])
  const setTurns = useCallback((value: SetStateAction<Turn[]>) => { dispatch({ type: 'set', field: 'turns', value }) }, [dispatch])
  const setEnded = useCallback((value: SetStateAction<boolean>) => { dispatch({ type: 'set', field: 'ended', value }) }, [dispatch])
  const setWalkingWith = useCallback((value: SetStateAction<string[] | null>) => { dispatch({ type: 'set', field: 'walkingWith', value }) }, [dispatch])
  const setSleepingOver = useCallback((value: SetStateAction<boolean>) => { dispatch({ type: 'set', field: 'sleepingOver', value }) }, [dispatch])
  return { session, getSession, dispatch, setState, setScene, setTurns, setEnded, setWalkingWith, setSleepingOver }
}
