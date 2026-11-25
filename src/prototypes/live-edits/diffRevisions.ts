/**
 * Marks what an edit changed in one element, word by word. Added text goes in
 * `<ins class="live-change">`; removed text comes back in
 * `<del class="live-change">` where it was.
 */

/** Elements that show no text to the reader. */
const HIDDEN_TAGS = new Set(['STYLE', 'SCRIPT', 'LINK', 'META'])

/** Above this many comparison cells, the change is not marked. */
const MAX_CELLS = 2_000_000

export const CHANGE_CLASS = 'live-change'
export const ADDED_CLASS = 'live-change--added'
export const REMOVED_CLASS = 'live-change--removed'

/** Reference markers such as "[12]" are ignored. */
function isSkipped(el: Element): boolean {
  return HIDDEN_TAGS.has(el.tagName) || el.classList.contains('mw-ref')
}

/** The visible text nodes of `root`, in document order. */
function textNodes(root: Node): Text[] {
  const nodes: Text[] = []
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) nodes.push(child as Text)
      else if (child.nodeType === Node.ELEMENT_NODE && !isSkipped(child as Element)) walk(child)
    }
  }
  walk(root)
  return nodes
}

type Op = { type: 'equal' | 'insert' | 'delete'; a: number; b: number }

/**
 * The shortest edit script from `a` to `b` (longest common subsequence).
 * Returns `null` when the inputs are too large to compare.
 */
function diffSequences(a: string[], b: string[]): Op[] | null {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }

  const n = endA - start
  const m = endB - start
  if (n * m > MAX_CELLS) return null

  // table[i][j]: common length of a[start+i..endA) and b[start+j..endB).
  const width = m + 1
  const table = new Uint32Array((n + 1) * width)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[start + i] === b[start + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const ops: Op[] = []
  for (let k = 0; k < start; k++) ops.push({ type: 'equal', a: k, b: k })
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && a[start + i] === b[start + j]) {
      ops.push({ type: 'equal', a: start + i, b: start + j })
      i++
      j++
    } else if (i < n && (j === m || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
      // Removals come before additions, so a replaced word reads old, then new.
      ops.push({ type: 'delete', a: start + i, b: start + j })
      i++
    } else {
      ops.push({ type: 'insert', a: start + i, b: start + j })
      j++
    }
  }
  for (let k = 0; k < a.length - endA; k++) {
    ops.push({ type: 'equal', a: endA + k, b: endB + k })
  }
  return ops
}

/** Words, runs of space and single punctuation marks. */
const TOKEN = /\s+|[\p{L}\p{N}\p{M}_]+|[^\s\p{L}\p{N}\p{M}_]/gu

interface Token {
  text: string
  node: Text
  start: number
  end: number
}

function tokens(root: Element): Token[] {
  const result: Token[] = []
  for (const node of textNodes(root)) {
    for (const match of node.data.matchAll(TOKEN)) {
      const start = match.index ?? 0
      result.push({ text: match[0], node, start, end: start + match[0].length })
    }
  }
  return result
}

function oldWords(root: Element): string[] {
  return textNodes(root).flatMap((node) => node.data.match(TOKEN) ?? [])
}

function isSpace(text: string): boolean {
  return /^\s*$/.test(text)
}

/** A piece of a text node, rebuilt as plain text, an addition or a removal. */
interface Piece {
  kind: 'text' | 'added' | 'removed'
  text: string
}

/** Marks the words in `newEl` that differ from `oldEl`. Returns false when nothing visible changed. */
export function markWords(oldEl: Element, newEl: Element): boolean {
  const before = oldWords(oldEl)
  const after = tokens(newEl)
  const ops = diffSequences(
    before,
    after.map((token) => token.text),
  )
  if (!ops) return false

  const doc = newEl.ownerDocument
  const pieces = new Map<Text, Piece[]>()
  const push = (node: Text, piece: Piece): void => {
    const list = pieces.get(node) ?? []
    const last = list[list.length - 1]
    // Space between two changes of one kind joins them into one mark.
    if (last && last.kind === piece.kind) last.text += piece.text
    else list.push(piece)
    pieces.set(node, list)
  }

  let changed = false
  let removed = ''
  /** Removed words wait for the next kept or added word, and go before it. */
  const flushRemoved = (node: Text): void => {
    if (!isSpace(removed)) {
      push(node, { kind: 'removed', text: removed })
      changed = true
    }
    removed = ''
  }

  for (const op of ops) {
    if (op.type === 'delete') {
      removed += before[op.a]
      continue
    }
    const token = after[op.b]
    if (removed) flushRemoved(token.node)
    const list = pieces.get(token.node)
    const afterAdded = list?.[list.length - 1]?.kind === 'added'
    if (op.type === 'insert' && (!isSpace(token.text) || afterAdded)) {
      // Added space joins the addition before it, so a phrase is one mark.
      push(token.node, { kind: 'added', text: token.text })
      if (!isSpace(token.text)) changed = true
    } else {
      push(token.node, { kind: 'text', text: token.text })
    }
  }
  const lastNode = after[after.length - 1]?.node
  if (removed && lastNode) flushRemoved(lastNode)
  if (!changed) return false

  for (const [node, list] of pieces) {
    const fragment = doc.createDocumentFragment()
    for (const piece of list) {
      if (piece.kind === 'text') {
        fragment.append(piece.text)
        continue
      }
      const mark = doc.createElement(piece.kind === 'added' ? 'ins' : 'del')
      mark.className = `${CHANGE_CLASS} ${piece.kind === 'added' ? ADDED_CLASS : REMOVED_CLASS}`
      mark.textContent = piece.text
      fragment.append(mark)
    }
    node.replaceWith(fragment)
  }
  return true
}
