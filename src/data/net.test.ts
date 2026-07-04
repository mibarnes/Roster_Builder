import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetNet, __setNetTestHooks, fetchWithPolicy } from '../../scripts/collect/net.ts'

/** Minimal Response stand-in for the injected fetch impl. */
const res = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Response => {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    status,
    url: 'https://x/final',
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  } as unknown as Response
}

/** A fake clock + no-wait sleep so backoff/rate-limit are instant + assertable. */
const fakeTime = () => {
  let t = 0
  const now = () => t
  const sleep = vi.fn(async (ms: number) => {
    t += ms
  })
  return { now, sleep, at: () => t }
}

afterEach(() => __resetNet())

describe('net — retry / backoff / 429', () => {
  it('retries a 429 honoring Retry-After, then returns the 200 body', async () => {
    const clock = fakeTime()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(429, 'slow down', { 'Retry-After': '2' }))
      .mockResolvedValueOnce(res(200, '{"ok":true}'))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep })

    const r = await fetchWithPolicy('https://api/x', { host: 'cfbd' })

    expect(r.ok).toBe(true)
    expect(r.json<{ ok: boolean }>().ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    // Retry-After: 2s honored (plus the host's own 200ms spacing on the 2nd start).
    expect(clock.sleep).toHaveBeenCalledWith(2000)
  })

  it('retries transient 5xx then succeeds', async () => {
    const clock = fakeTime()
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(200, 'ok'))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep })

    const r = await fetchWithPolicy('https://api/x', { host: 'espn' })
    expect(r.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('returns a non-retryable 404 immediately without throwing', async () => {
    const clock = fakeTime()
    const fetchImpl = vi.fn().mockResolvedValue(res(404, 'nope'))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep })

    const r = await fetchWithPolicy('https://api/x', { host: 'cfbd' })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(404)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting retries on repeated network errors', async () => {
    const clock = fakeTime()
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep })

    await expect(fetchWithPolicy('https://api/x', { host: 'cfbd', retries: 3 })).rejects.toThrow(
      'ECONNRESET',
    )
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })
})

describe('net — rate limiter', () => {
  it('spaces concurrent same-host requests by the host interval', async () => {
    const clock = fakeTime()
    const fetchImpl = vi.fn().mockResolvedValue(res(200, 'ok'))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep })

    await Promise.all([
      fetchWithPolicy('https://api/a', { host: 'cfbd' }),
      fetchWithPolicy('https://api/b', { host: 'cfbd' }),
      fetchWithPolicy('https://api/c', { host: 'cfbd' }),
    ])
    // 3 cfbd calls spaced 200ms apart → the last starts at ≥400ms on the fake clock.
    expect(clock.at()).toBeGreaterThanOrEqual(400)
  })
})

describe('net — on-disk cache + conditional GET', () => {
  it('reuses the cached body on a 304 and refreshes without re-downloading', async () => {
    const clock = fakeTime()
    const cacheRoot = mkdtempSync(join(tmpdir(), 'net-cache-'))
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(200, '{"v":1}', { ETag: 'abc' }))
      .mockResolvedValueOnce(res(304, '', {}))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep, cacheRoot })

    const first = await fetchWithPolicy('https://api/cache', { host: 'cfbd' })
    expect(first.fromCache).toBe(false)
    expect(first.json<{ v: number }>().v).toBe(1)

    const second = await fetchWithPolicy('https://api/cache', { host: 'cfbd' })
    expect(second.fromCache).toBe(true)
    expect(second.json<{ v: number }>().v).toBe(1)
    // 2nd request must have sent the conditional header.
    const secondInit = fetchImpl.mock.calls[1]![1] as RequestInit
    expect((secondInit.headers as Record<string, string>)['If-None-Match']).toBe('abc')
  })

  it('serves a fresh-enough cache via ttl without any network call', async () => {
    const clock = fakeTime()
    const cacheRoot = mkdtempSync(join(tmpdir(), 'net-cache-'))
    const fetchImpl = vi.fn().mockResolvedValue(res(200, '{"v":2}', { ETag: 'e' }))
    __setNetTestHooks({ fetchImpl, now: clock.now, sleep: clock.sleep, cacheRoot })

    await fetchWithPolicy('https://api/ttl', { host: 'cfbd', ttlMs: 60_000 })
    const cached = await fetchWithPolicy('https://api/ttl', { host: 'cfbd', ttlMs: 60_000 })

    expect(cached.fromCache).toBe(true)
    expect(cached.json<{ v: number }>().v).toBe(2)
    expect(fetchImpl).toHaveBeenCalledTimes(1) // second served from cache, no network
  })
})
