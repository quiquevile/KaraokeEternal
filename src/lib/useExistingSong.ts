import { useEffect, useState } from 'react'
import HttpApi from './HttpApi'

const api = new HttpApi()

// debounced lookup for an existing library song with the same artist and
// title: warns before a download or retag without blocking (the server's
// own checks decide, they know the folder rules). The result is keyed by
// the queried pair so cleared/edited fields never show a stale warning.
export const useExistingSong = (
  artist: string,
  title: string,
  excludeSongId: number | null = null,
): number | null => {
  const a = artist.trim()
  const t = title.trim()
  const key = a && t ? `${a}\n${t}` : ''
  const [result, setResult] = useState<{ key: string, songId: number | null } | null>(null)

  useEffect(() => {
    if (!key) return

    let cancelled = false
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.post<{ songId: number | null }>('song/find', { body: { artist: a, title: t } })

          if (cancelled) return

          const hit = res.songId
          setResult({ key, songId: hit !== null && hit !== excludeSongId ? hit : null })
        } catch {
          // the warning is best-effort: failures stay silent
          if (!cancelled) setResult({ key, songId: null })
        }
      })()
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [key, a, t, excludeSongId])

  if (!key || result === null || result.key !== key) return null

  return result.songId
}

export default useExistingSong
