/**
 * A visual diff of one edit for the Review changes preview: the article as
 * readers see it, before and after, with only the changed blocks shown. Blocks
 * (paragraphs, headings, list items, table cells…) are lined up by their text.
 * A block that changed shows its changed words; a block that was added or
 * removed shows whole. Each run of changes carries the section it is in.
 *
 * PROTOWIKI+ VisualEditor's own visual diff is not available outside the wiki.
 * This one compares readers' HTML, so a change that shows no text (a template
 * parameter, a link target, a category) shows no change here.
 */

import { diffSequences, markWords } from '../live-edits/diffRevisions'
import { fetchRevisionHtml, WIKI_ORIGIN } from './fetchRevisions'

export interface VisualDiff {
  /** The changed blocks, as HTML. Empty when no text changed. */
  html: string
  /** More blocks changed than the preview shows. */
  truncated: boolean
}

/** Blocks the diff lines up. Only the innermost of nested blocks counts. */
const BLOCK_SELECTOR = 'p, h2, h3, h4, h5, h6, li, dt, dd, th, td, caption, figcaption, blockquote'
const HEADING_TAGS = new Set(['H2', 'H3', 'H4', 'H5', 'H6'])

/**
 * Parts that are not article text, or that change when other parts change:
 * reference markers renumber when a reference is added before them.
 */
const STRIPPED_SELECTOR =
  'style, script, link, meta, sup.reference, .mw-ref, .mw-editsection, .navbox, .mw-empty-elt'

/** Most changed blocks the preview shows. */
const MAX_BLOCKS = 40

/** Share of words two blocks must have in common to count as one changed block. */
const SAME_BLOCK_MIN_OVERLAP = 0.4

const ADDED_CLASS = 'home-visual-diff__block--added'
const REMOVED_CLASS = 'home-visual-diff__block--removed'
const CHANGED_CLASS = 'home-visual-diff__block--changed'

function parse(html: string): Element {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild!
  for (const el of Array.from(root.querySelectorAll(STRIPPED_SELECTOR))) el.remove()
  return root
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The innermost blocks with text, in document order. */
function blocksOf(root: Element): Element[] {
  return Array.from(root.querySelectorAll(BLOCK_SELECTOR)).filter(
    (el) => textOf(el) && !el.querySelector(BLOCK_SELECTOR),
  )
}

/** Whether two blocks are one block, changed, rather than one removed and one added. */
function isSameBlock(before: string, after: string): boolean {
  const beforeWords = new Set(before.toLowerCase().split(' '))
  const afterWords = after.toLowerCase().split(' ')
  const shared = afterWords.filter((word) => beforeWords.has(word)).length
  return shared / Math.max(beforeWords.size, afterWords.length) >= SAME_BLOCK_MIN_OVERLAP
}

/**
 * A copy of the block to show on its own. A heading or paragraph stays as it
 * is. A list item stays in a list, for its marker. Anything else (a table
 * cell, a caption) becomes a plain block.
 */
function standalone(block: Element, className: string): Element {
  const doc = block.ownerDocument
  if (HEADING_TAGS.has(block.tagName) || block.tagName === 'P') {
    const copy = block.cloneNode(true) as Element
    copy.classList.add(className)
    return copy
  }
  if (block.tagName === 'LI') {
    const list = doc.createElement(block.parentElement?.tagName === 'OL' ? 'ol' : 'ul')
    list.className = className
    list.append(block.cloneNode(true))
    return list
  }
  const plain = doc.createElement('div')
  plain.className = className
  plain.append(...Array.from(block.cloneNode(true).childNodes))
  return plain
}

/** The section heading a block is in: the last heading before it. */
function sectionOf(blocks: Element[], index: number): string | null {
  for (let i = Math.min(index, blocks.length - 1); i >= 0; i--) {
    if (HEADING_TAGS.has(blocks[i].tagName)) return textOf(blocks[i])
  }
  return null
}

/** Links lead to the wiki, in a new tab; links within the page go nowhere. */
function fixLinks(root: Element): void {
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    const href = link.getAttribute('href') ?? ''
    if (href.startsWith('#')) {
      link.removeAttribute('href')
      continue
    }
    if (href.startsWith('/') && !href.startsWith('//'))
      link.setAttribute('href', WIKI_ORIGIN + href)
    link.setAttribute('target', '_blank')
    link.setAttribute('rel', 'noopener')
  }
}

/** The changed blocks of `afterHtml` against `beforeHtml`. Returns null when too large to compare. */
export function buildVisualDiff(beforeHtml: string, afterHtml: string): VisualDiff | null {
  const beforeBlocks = blocksOf(parse(beforeHtml))
  const afterBlocks = blocksOf(parse(afterHtml))
  const beforeTexts = beforeBlocks.map(textOf)
  const afterTexts = afterBlocks.map(textOf)
  const ops = diffSequences(beforeTexts, afterTexts)
  if (!ops) return null

  const output = document.createElement('div')
  let shownBlocks = 0
  let truncated = false

  const show = (el: Element): void => {
    if (shownBlocks >= MAX_BLOCKS) {
      truncated = true
      return
    }
    output.append(el)
    shownBlocks++
  }

  /** One run of changes: the removed blocks, the added ones, and where they go. */
  const showRun = (removed: number[], added: number[], afterIndex: number): void => {
    if (!removed.length && !added.length) return
    const section = sectionOf(afterBlocks, afterIndex - 1)
    const label = document.createElement('div')
    label.className = 'home-visual-diff__section'
    label.textContent = section ?? 'Lead'
    if (shownBlocks < MAX_BLOCKS) output.append(label)

    let a = 0
    let b = 0
    while (a < removed.length || b < added.length) {
      const before = removed[a]
      const after = added[b]
      if (
        before !== undefined &&
        after !== undefined &&
        isSameBlock(beforeTexts[before], afterTexts[after])
      ) {
        const copy = standalone(afterBlocks[after], CHANGED_CLASS)
        markWords(beforeBlocks[before], copy)
        show(copy)
        a++
        b++
      } else if (
        before !== undefined &&
        (after === undefined || removed.length - a >= added.length - b)
      ) {
        show(standalone(beforeBlocks[before], REMOVED_CLASS))
        a++
      } else {
        show(standalone(afterBlocks[after], ADDED_CLASS))
        b++
      }
    }
  }

  let removed: number[] = []
  let added: number[] = []
  let runStart = 0
  for (const op of ops) {
    if (op.type === 'equal') {
      showRun(removed, added, runStart)
      removed = []
      added = []
      runStart = op.b + 1
    } else if (op.type === 'delete') {
      removed.push(op.a)
    } else {
      added.push(op.b)
    }
  }
  showRun(removed, added, runStart)

  fixLinks(output)
  return { html: output.innerHTML, truncated }
}

const diffCache = new Map<number, VisualDiff | null>()

/**
 * The visual diff of one edit, from both revisions' HTML. A page's first
 * revision is all added. Cached by revision, which never changes.
 */
export async function loadVisualDiff(
  revid: number,
  parentid: number,
  signal: AbortSignal,
): Promise<VisualDiff | null> {
  if (diffCache.has(revid)) return diffCache.get(revid)!
  const [beforeHtml, afterHtml] = await Promise.all([
    parentid ? fetchRevisionHtml(parentid, signal) : Promise.resolve(''),
    fetchRevisionHtml(revid, signal),
  ])
  const diff = buildVisualDiff(beforeHtml, afterHtml)
  diffCache.set(revid, diff)
  return diff
}
