import { computed, ref } from 'vue'

import { DEFAULT_BACKLOGS, type BacklogCategory } from './loadBacklogs'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-community-config-v1'

/** "Foo" or "Category:Foo" → "Category:Foo", with spaces for underscores. */
export function categoryTitle(name: string): string {
  const title = name.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return /^category:/i.test(title) ? `Category:${title.slice(9).trim()}` : `Category:${title}`
}

/** A fresh id for a backlog an admin adds: its route segment and selection key. */
export function newBacklogId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Complete entries only, each id once. */
function normalize(value: unknown): BacklogCategory[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    const record =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const { id, label, title, threshold } = record
    if (typeof id !== 'string' || !id || seen.has(id)) return []
    if (typeof label !== 'string' || typeof title !== 'string') return []
    if (typeof threshold !== 'number' || !Number.isFinite(threshold)) return []
    seen.add(id)
    return [{ id, label, title, threshold }]
  })
}

function load(): BacklogCategory[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return (raw && normalize(JSON.parse(raw))) || [...DEFAULT_BACKLOGS]
  } catch {
    // Unavailable storage or corrupt JSON — start from the defaults.
    return [...DEFAULT_BACKLOGS]
  }
}

// Module-level: the module, its dialog, its pages and the editor read the same list.
const backlogs = ref<BacklogCategory[] | null>(null)

/**
 * The backlogs Community Configuration offers the Backlogs module — the
 * `GrowthBacklogs` feature. Kept in localStorage, in place of the wiki's JSON
 * config page.
 */
export function useBacklogConfig() {
  backlogs.value ??= load()

  const all = computed<readonly BacklogCategory[]>(() => backlogs.value ?? [])

  function find(id: string): BacklogCategory | undefined {
    return all.value.find((backlog) => backlog.id === id)
  }

  function save(next: readonly BacklogCategory[]): void {
    backlogs.value = normalize(next) ?? []
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backlogs.value))
    } catch {
      // Quota or private mode — the in-memory list still works for this visit.
    }
  }

  return { backlogs: all, find, save }
}
