/**
 * A page's newest edits (Action API `prop=revisions`), replayed as if they
 * happen live.
 */
import { wikimediaApiFetchHeaders } from '@/config'

export const WIKI_HOST = 'en.wikipedia.org'

export interface RecentEdit {
  revid: number
  /** 0 for the page's first revision. */
  parentid: number
  /** Empty when the username is hidden. */
  user: string
}

interface ApiRevision {
  revid: number
  parentid?: number
  user?: string
  userhidden?: boolean
}

/** The newest `limit` edits to `title`, newest first. */
export async function fetchRecentEdits(
  title: string,
  limit = 50,
  signal?: AbortSignal,
): Promise<RecentEdit[]> {
  const query = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    titles: title,
    rvlimit: String(limit),
    rvprop: 'ids|user',
    redirects: '1',
    format: 'json',
    formatversion: '2',
    origin: '*',
  })
  const response = await fetch(`https://${WIKI_HOST}/w/api.php?${query}`, {
    signal,
    headers: wikimediaApiFetchHeaders('live-edits'),
  })
  if (!response.ok) throw new Error(`Could not load recent edits (HTTP ${response.status}).`)
  const data = (await response.json()) as {
    query?: { pages?: { revisions?: ApiRevision[] }[] }
  }
  const revisions = data.query?.pages?.[0]?.revisions ?? []
  return revisions.map((row) => ({
    revid: row.revid,
    parentid: row.parentid ?? 0,
    user: row.userhidden ? '' : (row.user ?? ''),
  }))
}

/**
 * The edit's diff on the wiki: the change against the revision before it.
 * The page's first revision has no diff, so the URL shows that revision.
 */
export function diffUrl(title: string, edit: RecentEdit): string {
  const params = new URLSearchParams({ title: title.replace(/ /g, '_') })
  if (edit.parentid) {
    params.set('diff', String(edit.revid))
    params.set('oldid', String(edit.parentid))
  } else {
    params.set('oldid', String(edit.revid))
  }
  return `https://${WIKI_HOST}/w/index.php?${params}`
}
