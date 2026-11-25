/**
 * localStorage writes for state the reader means to keep (settings, pins,
 * choices), which must not lose out to caches. Every prototype on a host shares
 * one quota (about 5 MB), and the article caches fill it. When a write doesn't
 * fit, the caches go — they only cost a refetch — and the write tries again.
 */

/** Keys that hold only cached API data: safe to clear at any time. */
const CACHE_KEY_PATTERNS: readonly RegExp[] = [
  /^protowiki:articleBody:/,
  /^protowiki:articleView:/,
  /^protowiki:vitalArticles:/,
  // Home prototypes' day caches (`protowiki-<prototype>-cache-v1:<slot>`) and the Impact cache.
  /^protowiki-[\w-]*cache-v\d+/,
]

function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError'
}

/** Remove every cache entry. Returns how many went. */
export function clearStorageCaches(store: Storage = window.localStorage): number {
  const keys: string[] = []
  for (let index = 0; index < store.length; index++) {
    const key = store.key(index)
    if (key && CACHE_KEY_PATTERNS.some((pattern) => pattern.test(key))) keys.push(key)
  }
  for (const key of keys) store.removeItem(key)
  return keys.length
}

/**
 * `localStorage.setItem`, but if storage is full, clear the caches and try once
 * more. Throws when it still doesn't fit (or storage is unavailable), as
 * `setItem` does.
 */
export function setItemKeepingState(key: string, value: string): void {
  const store = window.localStorage
  try {
    store.setItem(key, value)
  } catch (error) {
    if (!isQuotaError(error) || clearStorageCaches(store) === 0) throw error
    store.setItem(key, value)
  }
}
