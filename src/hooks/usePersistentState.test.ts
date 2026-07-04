import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { readStored, usePersistentState } from './usePersistentState.ts'

afterEach(() => window.localStorage.clear())

describe('usePersistentState', () => {
  it('seeds from the initial value and persists updates to localStorage', () => {
    const { result } = renderHook(() => usePersistentState('rb:test', { n: 1 }))
    expect(result.current[0]).toEqual({ n: 1 })

    act(() => result.current[1]({ n: 2 }))
    expect(result.current[0]).toEqual({ n: 2 })
    expect(readStored('rb:test')).toEqual({ n: 2 })
  })

  it('hydrates from an existing stored value', () => {
    window.localStorage.setItem('rb:test', JSON.stringify({ n: 9 }))
    const { result } = renderHook(() => usePersistentState('rb:test', { n: 1 }))
    expect(result.current[0]).toEqual({ n: 9 })
  })

  it('supports the functional updater form', () => {
    const { result } = renderHook(() => usePersistentState('rb:count', 0))
    act(() => result.current[1]((prev) => prev + 5))
    expect(result.current[0]).toBe(5)
    expect(readStored<number>('rb:count')).toBe(5)
  })

  it('readStored returns null on a missing/corrupt key', () => {
    expect(readStored('rb:missing')).toBeNull()
    window.localStorage.setItem('rb:bad', '{not json')
    expect(readStored('rb:bad')).toBeNull()
  })
})
