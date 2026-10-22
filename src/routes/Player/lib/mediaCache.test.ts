import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMediaCache, mediaCacheKey, type MediaCacheStore, type MediaMeta } from './mediaCache'

vi.stubGlobal('document', { baseURI: 'http://localhost/' })

if (typeof URL.createObjectURL !== 'function') {
  let seq = 0
  ;(URL as unknown as Record<string, unknown>).createObjectURL = () => `blob:test-${++seq}`
  ;(URL as unknown as Record<string, unknown>).revokeObjectURL = () => {}
}

class MemoryStore implements MediaCacheStore {
  blobs = new Map<string, Blob>()
  metas = new Map<string, MediaMeta>()

  async get (key: string) {
    return this.blobs.get(key)
  }

  async put (key: string, blob: Blob, meta: MediaMeta) {
    this.blobs.set(key, blob)
    this.metas.set(key, meta)
  }

  async delete (key: string) {
    this.blobs.delete(key)
    this.metas.delete(key)
  }

  async getAllMeta () {
    return [...this.metas.values()]
  }
}

const okResponse = (size: number) => new Response(new Uint8Array(size))
const respondWith = (size: number) => fetchMock.mockImplementation(() => Promise.resolve(okResponse(size)))
const tick = () => new Promise(resolve => setTimeout(resolve, 5))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

let store: MemoryStore
let cache: ReturnType<typeof createMediaCache>

beforeEach(() => {
  fetchMock.mockReset()
  store = new MemoryStore()
  cache = createMediaCache(async () => store)
})

describe('mediaCache', () => {
  it('1. miss: getPlayableUrl returns the direct URL and caches nothing', async () => {
    expect(await cache.getPlayableUrl(1, 'video')).toBe(mediaCacheKey(1, 'video'))
    expect(store.blobs.size).toBe(0)
  })

  it('2. hit: getPlayableUrl returns a blob URL after a prefetch', async () => {
    respondWith(100)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0 })
    expect(cache.getUsage()).toBe(100)

    const url = await cache.getPlayableUrl(1, 'video')
    expect(url).toMatch(/^blob:/)
  })

  it('3. prefetching a cdg song stores both the .cdg and the audio part', async () => {
    respondWith(10)
    await cache.prefetchMedia(2, 'cdg', { minHeadroom: 0 })

    expect(store.blobs.has(mediaCacheKey(2, 'cdg'))).toBe(true)
    expect(store.blobs.has(mediaCacheKey(2, 'audio'))).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('4. getCdgBuffer downloads once, later calls hit the cache', async () => {
    respondWith(10)

    const first = await cache.getCdgBuffer(3)
    const second = await cache.getCdgBuffer(3)

    expect(first.byteLength).toBe(10)
    expect(second.byteLength).toBe(10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('5. getCdgBuffer surfaces HTTP errors without caching', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response('not found', { status: 404 })))

    await expect(cache.getCdgBuffer(4)).rejects.toThrow('not found')
    expect(store.blobs.size).toBe(0)
  })

  it('6. prefetch stops once the free headroom would drop too low', async () => {
    respondWith(1000)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0, maxBytes: 1000 })

    fetchMock.mockClear()
    const ok = await cache.prefetchMedia(2, 'mp4', { minHeadroom: 600, maxBytes: 1000 })

    expect(ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('7. LRU eviction drops the oldest entry but never the protected one', async () => {
    respondWith(400)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0, maxBytes: 1000 })
    await tick()
    await cache.prefetchMedia(2, 'mp4', { minHeadroom: 0, maxBytes: 1000 })
    await tick()
    // song 3 overflows the cap: song 1 is the LRU candidate but is protected,
    // so song 2 goes instead
    await cache.prefetchMedia(3, 'mp4', {
      minHeadroom: 0,
      maxBytes: 1000,
      protectKeys: [mediaCacheKey(1, 'video')],
    })

    expect(store.blobs.has(mediaCacheKey(1, 'video'))).toBe(true)
    expect(store.blobs.has(mediaCacheKey(2, 'video'))).toBe(false)
    expect(store.blobs.has(mediaCacheKey(3, 'video'))).toBe(true)
    expect(cache.getUsage()).toBeLessThanOrEqual(1000)
  })

  it('8. a single file larger than the cap is not cached at all', async () => {
    respondWith(2000)
    const ok = await cache.prefetchMedia(9, 'mp4', { minHeadroom: 0, maxBytes: 1000 })

    expect(ok).toBe(true)
    expect(store.blobs.size).toBe(0)
    expect(cache.getUsage()).toBe(0)
  })

  it('9. a network failure stops prefetching without throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))

    expect(await cache.prefetchMedia(6, 'mp4', { minHeadroom: 0 })).toBe(false)
  })

  it('10. evictMedia removes every part of a song', async () => {
    respondWith(10)
    await cache.prefetchMedia(5, 'cdg', { minHeadroom: 0 })
    await cache.evictMedia(5, 'cdg')

    expect(store.blobs.size).toBe(0)
    expect(cache.getUsage()).toBe(0)
  })

  it('11. pruneExcept drops everything outside the keep list', async () => {
    respondWith(10)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0 })
    await tick()
    await cache.prefetchMedia(2, 'mp4', { minHeadroom: 0 })

    await cache.pruneExcept([mediaCacheKey(2, 'video')])

    expect(store.blobs.has(mediaCacheKey(1, 'video'))).toBe(false)
    expect(store.blobs.has(mediaCacheKey(2, 'video'))).toBe(true)
  })

  it('12. without a store everything degrades to direct streaming', async () => {
    const noStore = createMediaCache(async () => null)

    expect(await noStore.getPlayableUrl(1, 'video')).toBe(mediaCacheKey(1, 'video'))

    respondWith(5)
    expect(await noStore.prefetchMedia(1, 'mp4', { minHeadroom: 0 })).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(noStore.getUsage()).toBe(0)
    expect(await noStore.areKeysCached(1, 'mp4')).toBe(false)
  })

  it('13. areKeysCached is false until every part is stored', async () => {
    expect(await cache.areKeysCached(1, 'mp4')).toBe(false)

    respondWith(10)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0 })

    expect(await cache.areKeysCached(1, 'mp4')).toBe(true)
    expect(await cache.areKeysCached(1, 'cdg')).toBe(false)
  })

  it('14. areKeysCached requires both parts of a cdg song', async () => {
    respondWith(10)
    await cache.prefetchMedia(2, 'cdg', { minHeadroom: 0 })

    expect(await cache.areKeysCached(2, 'cdg')).toBe(true)

    await cache.evictMedia(2, 'cdg')
    await store.put(mediaCacheKey(2, 'audio'), new Blob([new Uint8Array(10)]), {
      key: mediaCacheKey(2, 'audio'),
      size: 10,
      lastAccess: Date.now(),
    })
    // re-init the in-memory entries from the modified store
    const partial = createMediaCache(async () => store)

    expect(await partial.areKeysCached(2, 'cdg')).toBe(false)
  })

  it('15. areKeysCached drops stale metas whose blob is gone', async () => {
    respondWith(10)
    await cache.prefetchMedia(1, 'mp4', { minHeadroom: 0 })
    await store.delete(mediaCacheKey(1, 'video'))

    expect(await cache.areKeysCached(1, 'mp4')).toBe(false)
  })
})
