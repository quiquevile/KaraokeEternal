// Media cache for the player window: upcoming queue items are downloaded
// ahead of time so playback can ride out connection hiccups. Storage is
// IndexedDB (available on plain-HTTP LAN origins, unlike the Cache API),
// capped with LRU eviction; finished songs are evicted as they leave
// playback. Any failure degrades to today's behavior (direct streaming).

export type MediaType = 'cdg' | 'mp4'
export type MediaPartType = 'audio' | 'cdg' | 'video'

export const MAX_CACHE_BYTES = 500 * 1024 * 1024
// stop prefetching when less than this would remain free: most karaoke
// files fit, and it avoids thrashing the cache with one huge file
export const MIN_PREFETCH_HEADROOM = 64 * 1024 * 1024

export interface MediaMeta {
  key: string
  size: number
  lastAccess: number
}

export interface MediaCacheStore {
  get(key: string): Promise<Blob | undefined>
  put(key: string, blob: Blob, meta: MediaMeta): Promise<void>
  delete(key: string): Promise<void>
  getAllMeta(): Promise<MediaMeta[]>
}

export interface PrefetchOptions {
  signal?: AbortSignal
  protectKeys?: string[]
  maxBytes?: number
  minHeadroom?: number
}

export interface MediaCache {
  getPlayableUrl(mediaId: number, type: MediaPartType): Promise<string>
  getCdgBuffer(mediaId: number): Promise<ArrayBuffer>
  prefetchMedia(mediaId: number, type: MediaType, options?: PrefetchOptions): Promise<boolean>
  evictMedia(mediaId: number, type: MediaType): Promise<void>
  pruneExcept(keepKeys: string[]): Promise<void>
  getUsage(): number
}

// ------------------------------------
// IndexedDB store
// ------------------------------------
const DB_NAME = 'kes-media-cache'
const STORE_NAME = 'media'

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
  }
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const reqToPromise = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export const createIdbStore = async (): Promise<MediaCacheStore | null> => {
  if (typeof indexedDB === 'undefined') return null

  try {
    const db = await openDb()

    return {
      async get (key: string) {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const record = await reqToPromise(tx.objectStore(STORE_NAME).get(key) as IDBRequest<MediaRecord | undefined>)
        return record?.blob
      },
      async put (key: string, blob: Blob, meta: MediaMeta) {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        await reqToPromise(tx.objectStore(STORE_NAME).put({ ...meta, key, blob }))
      },
      async delete (key: string) {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        await reqToPromise(tx.objectStore(STORE_NAME).delete(key))
      },
      async getAllMeta () {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const records = await reqToPromise(tx.objectStore(STORE_NAME).getAll() as IDBRequest<MediaRecord[]>)
        return records.map(({ key, size, lastAccess }) => ({ key, size, lastAccess }))
      },
    }
  } catch {
    return null
  }
}

interface MediaRecord extends MediaMeta {
  blob: Blob
}

// ------------------------------------
// media cache
// ------------------------------------
export const mediaCacheKey = (mediaId: number, type: MediaPartType): string =>
  `${document.baseURI}api/media/${mediaId}?type=${type}`

export const createMediaCache = (getStore: () => Promise<MediaCacheStore | null>): MediaCache => {
  const entries = new Map<string, MediaMeta>()
  const blobUrls = new Map<string, string>()
  let store: MediaCacheStore | null = null
  let initPromise: Promise<void> | null = null

  const ensureInit = (): Promise<void> => {
    initPromise ??= (async () => {
      try {
        store = await getStore()
        if (!store) return
        const metas = await store.getAllMeta()
        for (const meta of metas) entries.set(meta.key, meta)
      } catch {
        // unreadable store: behave as if there is no cache
        store = null
      }
    })()
    return initPromise
  }

  const revoke = (key: string) => {
    const url = blobUrls.get(key)
    if (url) {
      URL.revokeObjectURL(url)
      blobUrls.delete(key)
    }
  }

  const removeKey = async (key: string) => {
    entries.delete(key)
    revoke(key)
    try {
      await store?.delete(key)
    } catch {
      // best-effort: a leftover blob is reclaimed on the next limit pass
    }
  }

  const putEntry = async (key: string, blob: Blob) => {
    if (!store) return
    const meta: MediaMeta = { key, size: blob.size, lastAccess: Date.now() }
    entries.set(key, meta)
    try {
      await store.put(key, blob, meta)
    } catch {
      // full/blocked storage: the in-memory entry keeps this session working
    }
  }

  const getUsage = (): number => {
    let usage = 0
    for (const meta of entries.values()) usage += meta.size
    return usage
  }

  const enforceLimit = async (maxBytes: number, protectKeys: string[]) => {
    let usage = getUsage()
    if (usage <= maxBytes) return

    const candidates = [...entries.values()]
      .filter(meta => !protectKeys.includes(meta.key))
      .sort((a, b) => a.lastAccess - b.lastAccess)

    for (const meta of candidates) {
      if (usage <= maxBytes) break
      usage -= meta.size
      await removeKey(meta.key)
    }
  }

  const partTypes = (type: MediaType): MediaPartType[] =>
    type === 'cdg' ? ['cdg', 'audio'] : ['video']

  const getPlayableUrl = async (mediaId: number, type: MediaPartType): Promise<string> => {
    const key = mediaCacheKey(mediaId, type)

    try {
      await ensureInit()
      const meta = entries.get(key)
      if (meta) {
        const blob = await store?.get(key)
        if (blob) {
          meta.lastAccess = Date.now()
          let url = blobUrls.get(key)
          if (!url && typeof URL.createObjectURL === 'function') {
            url = URL.createObjectURL(blob)
            blobUrls.set(key, url)
          }
          return url ?? key
        }
        // meta without blob: drop the stale entry
        entries.delete(key)
      }
    } catch {
      // fall through to direct streaming
    }

    return key
  }

  const getCdgBuffer = async (mediaId: number): Promise<ArrayBuffer> => {
    const key = mediaCacheKey(mediaId, 'cdg')

    await ensureInit()
    const meta = entries.get(key)
    if (meta) {
      const blob = await store?.get(key)
      if (blob) {
        meta.lastAccess = Date.now()
        return await blob.arrayBuffer()
      }
      entries.delete(key)
    }

    const response = await fetch(key)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `HTTP ${response.status}`)
    }

    const blob = await response.blob()
    await putEntry(key, blob)
    return await blob.arrayBuffer()
  }

  const prefetchMedia = async (mediaId: number, type: MediaType, options: PrefetchOptions = {}): Promise<boolean> => {
    const {
      signal,
      protectKeys = [],
      maxBytes = MAX_CACHE_BYTES,
      minHeadroom = MIN_PREFETCH_HEADROOM,
    } = options

    await ensureInit()
    // nothing to store into: prefetching would only double-download
    if (!store) return false

    for (const partType of partTypes(type)) {
      if (signal?.aborted) return false

      const key = mediaCacheKey(mediaId, partType)
      const meta = entries.get(key)
      if (meta) {
        meta.lastAccess = Date.now()
        continue
      }

      if (getUsage() + minHeadroom > maxBytes) return false

      try {
        const response = await fetch(key, { signal })
        if (!response.ok) {
          // leave the miss in place: playback streams the URL directly
          await response.arrayBuffer().catch(() => {})
          continue
        }

        const blob = await response.blob()
        if (blob.size > maxBytes) continue

        await putEntry(key, blob)
        await enforceLimit(maxBytes, protectKeys)
      } catch {
        // aborted or network failure: stop prefetching, playback streams
        return false
      }
    }

    return true
  }

  const evictMedia = async (mediaId: number, type: MediaType) => {
    await ensureInit()
    for (const partType of partTypes(type)) {
      await removeKey(mediaCacheKey(mediaId, partType))
    }
  }

  const pruneExcept = async (keepKeys: string[]) => {
    await ensureInit()
    for (const key of [...entries.keys()]) {
      if (!keepKeys.includes(key)) await removeKey(key)
    }
  }

  return {
    getPlayableUrl,
    getCdgBuffer,
    prefetchMedia,
    evictMedia,
    pruneExcept,
    getUsage,
  }
}

// ------------------------------------
// player-facing singleton
// ------------------------------------
const defaultCache = createMediaCache(createIdbStore)

export const getPlayableUrl = (mediaId: number, type: MediaPartType): Promise<string> =>
  defaultCache.getPlayableUrl(mediaId, type)

export const getCdgBuffer = (mediaId: number): Promise<ArrayBuffer> =>
  defaultCache.getCdgBuffer(mediaId)

export const prefetchMedia = (mediaId: number, type: MediaType, options?: PrefetchOptions): Promise<boolean> =>
  defaultCache.prefetchMedia(mediaId, type, options)

export const evictMedia = (mediaId: number, type: MediaType): Promise<void> =>
  defaultCache.evictMedia(mediaId, type)

export const pruneExcept = (keepKeys: string[]): Promise<void> =>
  defaultCache.pruneExcept(keepKeys)
