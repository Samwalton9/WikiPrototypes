/**
 * Backlogs: English Wikipedia's admin backlog categories (as Community
 * Configuration sets them, `useBacklogConfig`), largest first, and the pages
 * waiting in each. Both are live and never cached: backlogs move all day.
 */

import { wikimediaApiFetchHeaders } from '@/config'

import { formatAgo } from './relativeTime'

/* The Home's lookups are English Wikipedia's. */
const HOST = 'en.wikipedia.org'

/** More pages than this, and a backlog is backlogged right now — until Community Configuration says otherwise. */
export const DEFAULT_THRESHOLD = 50

/** Pages listed on a category's own page — the Action API's most per call. */
const PAGE_LIMIT = 500

export interface BacklogCategory {
  /** URL segment of the category's page, `/<home>/backlog/<id>`. */
  id: string
  label: string
  /** Full category title, with its namespace. */
  title: string
  /** More pages than this, and it's backlogged. */
  threshold: number
}

/** The backlogs before Community Configuration changes them. */
export const DEFAULT_BACKLOGS: readonly BacklogCategory[] = [
  {
    id: 'speedy-deletion',
    label: 'Candidates for speedy deletion',
    title: 'Category:Candidates for speedy deletion',
    threshold: DEFAULT_THRESHOLD,
  },
  {
    id: 'unblock-requests',
    label: 'Requests for unblock',
    title: 'Category:Requests for unblock',
    threshold: DEFAULT_THRESHOLD,
  },
  {
    id: 'copyright-problems',
    label: 'Pages tagged for copyright problems',
    title: 'Category:Wikipedia pages tagged for copyright problems',
    threshold: DEFAULT_THRESHOLD,
  },
  {
    id: 'coi-edit-requests',
    label: 'Conflict of interest edit requests',
    title: 'Category:Wikipedia conflict of interest edit requests',
    threshold: DEFAULT_THRESHOLD,
  },
  {
    id: 'expired-prods',
    label: 'Expired proposed deletions',
    title: 'Category:Expired proposed deletions',
    threshold: DEFAULT_THRESHOLD,
  },
  {
    id: 'commons-duplicates',
    label: 'Files with the same name on Wikimedia Commons',
    // The parent category holds only dated subcategories; this one holds every file.
    title: 'Category:All Wikipedia files with the same name on Wikimedia Commons',
    threshold: DEFAULT_THRESHOLD,
  },
]

/** One backlog category, as a backlog card shows it. */
export interface BacklogCard extends BacklogCategory {
  /** Pages and files in it (subcategories not counted). */
  count: number
  backlogged: boolean
}

/** One page waiting in a backlog category. */
export interface BacklogPage {
  key: string
  title: string
  /** The page on Wikipedia. */
  href: string
  /** When it joined the category, e.g. "3h ago". */
  ago: string
}

interface ApiCategoryInfo {
  pages?: number
  files?: number
}

/** The Category namespace. */
const CATEGORY_NAMESPACE = 14

interface ApiCategoryMember {
  pageid: number
  ns: number
  title: string
  timestamp?: string
}

async function action<T>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const search = new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' })
  const response = await fetch(`https://${HOST}/w/api.php?${search.toString()}`, {
    signal,
    headers: wikimediaApiFetchHeaders('home-backlogs'),
  })
  if (!response.ok) throw new Error(`Failed to load backlogs (HTTP ${response.status}).`)
  return (await response.json()) as T
}

export function pageUrl(title: string): string {
  return `https://${HOST}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

/** Each given backlog category's size, in one call, largest first. */
export async function loadBacklogCards(
  categories: readonly BacklogCategory[],
  signal: AbortSignal,
): Promise<BacklogCard[]> {
  if (!categories.length) return []
  const data = await action<{
    query?: { pages?: { title: string; categoryinfo?: ApiCategoryInfo }[] }
  }>(
    {
      action: 'query',
      prop: 'categoryinfo',
      titles: categories.map((category) => category.title).join('|'),
    },
    signal,
  )
  const info = new Map((data.query?.pages ?? []).map((page) => [page.title, page.categoryinfo]))

  return categories
    .map((category) => {
      const found = info.get(category.title)
      const count = (found?.pages ?? 0) + (found?.files ?? 0)
      return { ...category, count, backlogged: count > category.threshold }
    })
    .sort((a, b) => b.count - a.count)
}

/** The pages in one backlog category, newest to join first. */
export async function loadBacklogPages(
  category: BacklogCategory,
  signal: AbortSignal,
): Promise<BacklogPage[]> {
  const data = await action<{ query?: { categorymembers?: ApiCategoryMember[] } }>(
    {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category.title,
      // Ignored with `cmsort: 'timestamp'`: subcategories come back too, and are dropped below.
      cmtype: 'page|file',
      cmprop: 'ids|title|timestamp',
      cmsort: 'timestamp',
      cmdir: 'desc',
      cmlimit: String(PAGE_LIMIT),
    },
    signal,
  )
  return (data.query?.categorymembers ?? [])
    .filter((member) => member.ns !== CATEGORY_NAMESPACE)
    .map((member) => ({
      key: String(member.pageid),
      title: member.title,
      href: pageUrl(member.title),
      ago: member.timestamp ? `Added ${formatAgo(Date.parse(member.timestamp))}` : '',
    }))
}
