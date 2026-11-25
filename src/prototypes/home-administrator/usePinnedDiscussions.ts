import { computed, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

import type { DiscussionCard } from './loadActiveDiscussions'
import { formatAgo } from './relativeTime'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-pinned-discussions-v1'

const CARD_FIELDS = ['key', 'title', 'board', 'href', 'comments', 'latestReply'] as const

function isCard(value: unknown): value is DiscussionCard {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return CARD_FIELDS.every((field) => typeof record[field] === 'string')
}

function loadCards(): DiscussionCard[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isCard) : []
  } catch {
    // Unavailable storage or corrupt JSON — start with nothing pinned.
    return []
  }
}

// Module-level: the Home and the module's own page share the pins.
const pinned = ref<DiscussionCard[] | undefined>(undefined)

/**
 * The discussions the reader has pinned in Active discussions, newest pin
 * first, kept in localStorage. Each pin keeps a copy of its card, so it stays
 * after the thread drops out of the live list (or is archived).
 */
export function usePinnedDiscussions() {
  if (pinned.value === undefined) pinned.value = loadCards()

  /** The pinned cards, with "3h ago" worked out fresh. */
  const pinnedCards = computed(() =>
    (pinned.value ?? []).map((card) => ({
      ...card,
      ago: card.latestReply ? formatAgo(Date.parse(card.latestReply)) : '',
    })),
  )

  /** Pins are by the thread's link, which is unique across noticeboards. */
  const pinnedHrefs = computed(() => new Set((pinned.value ?? []).map((card) => card.href)))

  function togglePin(card: DiscussionCard): void {
    const current = pinned.value ?? []
    pinned.value = pinnedHrefs.value.has(card.href)
      ? current.filter((other) => other.href !== card.href)
      : [card, ...current]
    try {
      setItemKeepingState(STORAGE_KEY, JSON.stringify(pinned.value))
    } catch (error) {
      // Quota or private mode — the pins still work for this visit, but won't last a reload.
      console.warn(`[ProtoWiki][Active discussions] Couldn't save the pins:`, error)
    }
  }

  return { pinnedCards, pinnedHrefs, togglePin }
}
