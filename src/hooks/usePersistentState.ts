/**
 * usePersistentState — useState mirrored to localStorage (U4). Best-effort:
 * read/write failures (private mode, quota, disabled storage) fall back to
 * in-memory state and never throw. SSR-safe (guards `window`).
 */
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial
    try {
      const raw = window.localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* storage unavailable / full — keep the in-memory value */
    }
  }, [key, state])

  return [state, setState]
}

/** Read a JSON value from localStorage once (best-effort). */
export function readStored<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw != null ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
