import { computed, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-community-pins-v1'

/** A discussion admins pick for everyone's Community tab in Active discussions, as Community Configuration keeps it. */
export interface CommunityPin {
  /** Stable: the card's key when it isn't a live thread. */
  id: string
  /** The page the discussion is on, e.g. `Wikipedia:Village pump (policy)`. */
  page: string
  /** The thread's heading on that page. Empty: the whole page is the discussion. */
  section: string
}

/**
 * The prototype's examples, both invented: a thread on a village pump, and a
 * request for comment that is a page of its own (so no section). Their
 * activity is invented too (`EXAMPLE_ACTIVITY` in `loadActiveDiscussions.ts`).
 */
export const DEFAULT_PINS: readonly CommunityPin[] = [
  {
    id: 'example-village-pump-policy',
    page: 'Wikipedia:Village pump (policy)',
    section: 'RfC: Notability of podcasts and podcast episodes',
  },
  {
    id: 'example-rfc-admin-recall',
    page: 'Wikipedia:Requests for comment/Administrator recall review',
    section: '',
  },
]

/** A fresh id for a pin an admin adds. */
export function newPinId(): string {
  return `pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Spaces for underscores, single spaces, no ends. */
export function normalizeTitle(text: string): string {
  return text.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Complete entries only, each id once. */
function normalize(value: unknown): CommunityPin[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    const record =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const { id, page, section } = record
    if (typeof id !== 'string' || !id || seen.has(id)) return []
    if (typeof page !== 'string' || !page.trim() || typeof section !== 'string') return []
    seen.add(id)
    return [{ id, page: normalizeTitle(page), section: normalizeTitle(section) }]
  })
}

function load(): CommunityPin[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return (raw && normalize(JSON.parse(raw))) || [...DEFAULT_PINS]
  } catch {
    // Unavailable storage or corrupt JSON — start from the defaults.
    return [...DEFAULT_PINS]
  }
}

// Module-level: the module and the editor read the same list.
const pins = ref<CommunityPin[] | null>(null)

/**
 * The discussions admins pick for every reader's Community tab in Active
 * discussions — the `CommunityDiscussions` feature. Kept in localStorage, in place of the
 * wiki's JSON config page.
 */
export function useCommunityPinsConfig() {
  pins.value ??= load()

  const all = computed<readonly CommunityPin[]>(() => pins.value ?? [])

  function save(next: readonly CommunityPin[]): void {
    pins.value = normalize(next) ?? []
    try {
      setItemKeepingState(STORAGE_KEY, JSON.stringify(pins.value))
    } catch {
      // Quota or private mode — the in-memory list still works for this visit.
    }
  }

  /** Back to the defaults ("Reset to defaults" in the editor's "…" menu). */
  function reset(): void {
    save(DEFAULT_PINS)
  }

  return { pins: all, save, reset }
}
