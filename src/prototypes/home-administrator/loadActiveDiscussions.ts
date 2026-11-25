/**
 * Active discussions: busy threads on English Wikipedia's community
 * noticeboards (the administrators' noticeboards and the village pumps), from
 * DiscussionTools.
 */

import { wikimediaApiFetchHeaders } from '@/config'

import { readDayCache, utcDayKey, writeDayCache } from './homeCache'
import { formatAgo } from './relativeTime'
import { normalizeTitle, type CommunityPin } from './useCommunityPinsConfig'

const HOST = 'en.wikipedia.org'

/**
 * enwiki's noticeboards for the Personal dashboard (`wgPersonalDashboardActiveDiscussionsPages`,
 * T420785), for admins: the administrators' noticeboards in place of the help desk.
 */
const NOTICEBOARDS: readonly string[] = [
  "Wikipedia:Administrators' noticeboard",
  "Wikipedia:Administrators' noticeboard/Incidents",
  'Wikipedia:Village pump (miscellaneous)',
  'Wikipedia:Village pump (technical)',
  'Wikipedia:Village pump (idea lab)',
  'Wikipedia:Village pump (policy)',
  'Wikipedia:Village pump (proposals)',
]

const MAX_DISCUSSIONS = 20
/** Newest threads kept from every board, so the busiest one doesn't fill the list. */
const PER_BOARD_MIN = 2
const CACHE_SLOT = 'active-discussions'
/** Discussions move within the hour, so the day's list is refetched after one. */
const CACHE_MAX_AGE_MS = 60 * 60_000

/** One thread, as a discussion card shows it. */
export interface DiscussionCard {
  key: string
  title: string
  /** The noticeboard, without `Wikipedia:`. Empty when the discussion is the whole page. */
  board: string
  /** The thread on Wikipedia. */
  href: string
  /** "4 comments". Empty when unknown (a community discussion that isn't a live thread). */
  comments: string
  /** When the latest reply came, e.g. "3h ago". Empty when unknown. */
  ago: string
  /** The latest reply's timestamp (ISO 8601), so a pinned card can work out `ago` again. Empty when unknown. */
  latestReply: string
}

interface Thread {
  id: string
  title: string
  board: string
  comments: number
  latestReply: string
}

interface ApiThread {
  id: string
  headingLevel?: number | null
  html?: string
  commentCount?: number
  authorCount?: number
  latestReplyTimestamp?: string | null
}

/** A board's live threads: top-level sections where more than one person has spoken. */
async function fetchThreads(board: string, signal: AbortSignal): Promise<Thread[]> {
  const search = new URLSearchParams({
    action: 'discussiontoolspageinfo',
    page: board,
    prop: 'threaditemshtml',
    threaditemsflags: 'noreplies|excludesignatures|activity',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  const response = await fetch(`https://${HOST}/w/api.php?${search.toString()}`, {
    signal,
    headers: wikimediaApiFetchHeaders('home-active-discussions'),
  })
  if (!response.ok) throw new Error(`Failed to load discussions (HTTP ${response.status}).`)
  const data = (await response.json()) as {
    discussiontoolspageinfo?: { threaditemshtml?: ApiThread[] }
  }

  return (data.discussiontoolspageinfo?.threaditemshtml ?? []).flatMap((item) => {
    // Subsections (h3…) repeat their parent's activity, so only whole threads count.
    if (item.headingLevel !== 2 || (item.authorCount ?? 0) < 2 || !item.latestReplyTimestamp) {
      return []
    }
    const title = new DOMParser().parseFromString(item.html ?? '', 'text/html').body.textContent
    if (!title?.trim()) return []
    return [
      {
        id: item.id,
        title: title.trim(),
        board,
        comments: item.commentCount ?? 0,
        latestReply: item.latestReplyTimestamp,
      },
    ]
  })
}

const byLatestReply = (a: Thread, b: Thread) => b.latestReply.localeCompare(a.latestReply)

/** The most recently active threads, with each board's newest few guaranteed a place. */
function mergeThreads(boards: Thread[][]): Thread[] {
  const sorted = boards.map((threads) => [...threads].sort(byLatestReply))
  const guaranteed = sorted.flatMap((threads) => threads.slice(0, PER_BOARD_MIN))
  const rest = sorted.flatMap((threads) => threads.slice(PER_BOARD_MIN)).sort(byLatestReply)
  return [...guaranteed, ...rest.slice(0, Math.max(0, MAX_DISCUSSIONS - guaranteed.length))].sort(
    byLatestReply,
  )
}

function pageUrl(page: string): string {
  return `https://${HOST}/wiki/${encodeURI(page.replace(/ /g, '_'))}`
}

function toCard(thread: Thread): DiscussionCard {
  const url = pageUrl(thread.board)
  return {
    key: thread.id,
    title: thread.title,
    board: thread.board.replace(/^Wikipedia:/, ''),
    href: `${url}#${encodeURIComponent(thread.id)}`,
    comments: `${thread.comments} ${thread.comments === 1 ? 'comment' : 'comments'}`,
    ago: formatAgo(Date.parse(thread.latestReply)),
    latestReply: thread.latestReply,
  }
}

/**
 * Busy threads, most recent reply first. Boards are read one at a time; one
 * failing only shortens the list, all of them failing is an error. The same for
 * every reader.
 */
export async function loadActiveDiscussions(signal: AbortSignal): Promise<DiscussionCard[]> {
  const day = utcDayKey()
  // Threads are cached rather than cards, so "3h ago" is worked out fresh each load.
  const cached = readDayCache<Thread>(CACHE_SLOT, day, CACHE_MAX_AGE_MS)
  if (cached) return cached.map(toCard)

  const results: (Thread[] | null)[] = []
  for (const page of NOTICEBOARDS) {
    results.push(
      await fetchThreads(page, signal).catch((error: unknown) => {
        if (signal.aborted) throw error
        return null
      }),
    )
  }
  if (results.every((threads) => threads === null)) {
    throw new Error("Couldn't reach any noticeboard")
  }

  const threads = mergeThreads(results.map((board) => board ?? []))
  writeDayCache(CACHE_SLOT, day, threads)
  return threads.map(toCard)
}

/**
 * Invented activity for the prototype's example community discussions
 * (`DEFAULT_PINS`), which aren't live threads: comments, and hours since the
 * latest reply.
 */
const EXAMPLE_ACTIVITY: Record<string, { comments: number; hoursAgo: number }> = {
  'example-village-pump-policy': { comments: 47, hoursAgo: 3 },
  'example-rfc-admin-recall': { comments: 212, hoursAgo: 26 },
}

/**
 * The Community tab's cards: the discussions admins pick, in their order. One
 * with a section becomes its live thread when the page has a thread with that
 * heading (the same card, and link, as in the All tab, so a pin of one is a pin
 * of both). Otherwise — a whole page, or a thread gone to the archive — a card
 * with only the title and the page. Each page is read once. Not cached: admins
 * expect a new discussion to show at once.
 */
export async function loadCommunityPins(
  pins: readonly CommunityPin[],
  signal: AbortSignal,
): Promise<DiscussionCard[]> {
  const threadsByPage = new Map<string, Thread[]>()
  for (const page of new Set(pins.filter((pin) => pin.section).map((pin) => pin.page))) {
    threadsByPage.set(
      page,
      await fetchThreads(page, signal).catch((error: unknown) => {
        if (signal.aborted) throw error
        return []
      }),
    )
  }

  return pins.map((pin) => {
    const heading = pin.section.toLowerCase()
    const thread = heading
      ? threadsByPage
          .get(pin.page)
          ?.find((item) => normalizeTitle(item.title).toLowerCase() === heading)
      : undefined
    if (thread) return toCard(thread)
    const href = pin.section
      ? `${pageUrl(pin.page)}#${encodeURIComponent(pin.section.replace(/ /g, '_'))}`
      : pageUrl(pin.page)
    const example = EXAMPLE_ACTIVITY[pin.id]
    const latestReply = example
      ? new Date(Date.now() - example.hoursAgo * 60 * 60_000).toISOString()
      : ''
    return {
      key: pin.id,
      title: pin.section || pin.page.replace(/^Wikipedia:/, ''),
      // A whole page is its own title, so it has no page line under it.
      board: pin.section ? pin.page.replace(/^Wikipedia:/, '') : '',
      href,
      comments: example ? `${example.comments} comments` : '',
      ago: latestReply ? formatAgo(Date.parse(latestReply)) : '',
      latestReply,
    }
  })
}
