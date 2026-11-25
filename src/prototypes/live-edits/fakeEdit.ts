/** The made-up edit to an article's first paragraph, on Parsoid HTML. */

/** A removed sentence must have this many words, so that the removal is easy to see. */
const MIN_REMOVED_WORDS = 4

/** The lead's first paragraph with text, in an article body. */
export function leadParagraph(root: ParentNode): HTMLParagraphElement | undefined {
  return Array.from(
    root.querySelectorAll<HTMLParagraphElement>('section[data-mw-section-id="0"] > p'),
  ).find((p) => !p.classList.contains('mw-empty-elt') && p.textContent?.trim())
}

/**
 * Removes the last whole sentence that sits in one text node of the
 * paragraph (not in a link), with the space before it. Returns false when
 * there is none.
 */
function removeSentence(paragraph: HTMLParagraphElement): boolean {
  const textNodes = Array.from(paragraph.childNodes).filter(
    (node): node is Text => node.nodeType === Node.TEXT_NODE,
  )
  // A sentence starts after ". " and ends with ".", "!" or "?" before a space or the node end.
  const SENTENCE = /(?<=[.!?]\s+)[A-Z][^.!?]*[.!?](?=\s|$)/g
  for (const node of textNodes.reverse()) {
    const matches = Array.from(node.data.matchAll(SENTENCE)).filter(
      (match) => match[0].split(/\s+/).length >= MIN_REMOVED_WORDS,
    )
    const last = matches[matches.length - 1]
    if (!last || last.index === undefined) continue
    const before = node.data.slice(0, last.index).replace(/\s+$/, '')
    const after = node.data.slice(last.index + last[0].length)
    node.data = before + after
    return true
  }
  return false
}

/** Two sentences that suit almost any article. */
function addedSentences(title: string): string {
  // "Mercury (planet)" reads as "Mercury" in a sentence.
  const subject = title.replace(/\s*\([^)]*\)\s*$/, '')
  return (
    ` In 2026, ${subject} drew renewed public attention after a series of widely shared news` +
    ` reports. Several new academic studies about ${subject} were also published that year.`
  )
}

/** The made-up edit, on `paragraph`: maybe a removed sentence, and two added at the end. */
export function editParagraph(
  paragraph: HTMLParagraphElement,
  title: string,
  withRemoval: boolean,
): void {
  if (withRemoval) removeSentence(paragraph)
  paragraph.append(addedSentences(title))
}
