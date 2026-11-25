import { computed, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-quick-links-v1'

const WIKI = 'https://en.wikipedia.org'

/** One link in the Quick links module, as the reader keeps it. */
export interface QuickLink {
  id: string
  /** A page on the wiki (`Wikipedia:Administrator intervention against vandalism`, `WP:AIV`) or a web address. */
  target: string
  /** What the module shows. Empty: the page title, or the web address's site. */
  label: string
}

/** A web address, rather than a page title. */
export function isWebAddress(target: string): boolean {
  return /^https?:\/\//i.test(target.trim())
}

/** A page title with spaces, single and trimmed. */
export function normalizeTarget(target: string): string {
  const trimmed = target.trim()
  return isWebAddress(trimmed) ? trimmed : trimmed.replace(/_/g, ' ').replace(/\s+/g, ' ')
}

/** Where the link goes: the address itself, or the page on the wiki. */
export function quickLinkHref(link: QuickLink): string {
  if (isWebAddress(link.target)) return link.target
  const path = encodeURIComponent(link.target.replace(/ /g, '_'))
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':')
  return `${WIKI}/wiki/${path}`
}

/** What the module shows for the link: its label, else the page title or the site. */
export function quickLinkText(link: QuickLink): string {
  if (link.label) return link.label
  if (!isWebAddress(link.target)) return link.target
  try {
    return new URL(link.target).hostname
  } catch {
    return link.target
  }
}

/** A fresh id for a link the reader adds. */
export function newQuickLinkId(): string {
  return `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Complete entries only, each id once. */
function normalize(value: unknown): QuickLink[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    const record =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const { id, target, label } = record
    if (typeof id !== 'string' || !id || seen.has(id)) return []
    if (typeof target !== 'string' || !target.trim() || typeof label !== 'string') return []
    seen.add(id)
    return [{ id, target: normalizeTarget(target), label: label.trim() }]
  })
}

function load(): QuickLink[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : []
  } catch {
    // Unavailable storage or corrupt JSON — start with no links.
    return []
  }
}

// Module-level: the module and its dialog read the same list.
const links = ref<QuickLink[] | null>(null)

/**
 * The reader's own Quick links, in their order, kept in localStorage. Personal
 * only: there is no community list.
 */
export function useQuickLinks() {
  links.value ??= load()

  const all = computed<readonly QuickLink[]>(() => links.value ?? [])

  function save(next: readonly QuickLink[]): void {
    links.value = normalize(next)
    try {
      setItemKeepingState(STORAGE_KEY, JSON.stringify(links.value))
    } catch (error) {
      // Quota or private mode — the links still work for this visit, but won't last a reload.
      console.warn(`[ProtoWiki][Quick links] Couldn't save the links:`, error)
    }
  }

  return { links: all, save }
}
