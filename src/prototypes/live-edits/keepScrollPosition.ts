/**
 * Codex focuses a toast when it appears. On some browsers (mobile in
 * particular) that focus, and the focus loss when the toast goes, scrolls the
 * page. This holds the scroll position for a short time, so the article does
 * not jump. Any scroll by the reader ends the hold at once.
 */

/** Long enough for the toast to mount, focus and finish its transition. */
const HOLD_MS = 1000

const READER_INPUT = ['wheel', 'touchstart', 'touchmove', 'keydown', 'pointerdown'] as const

let release: (() => void) | null = null

/** Holds the page at its current scroll position for a moment. */
export function keepScrollPosition(): void {
  release?.()
  const x = window.scrollX
  const y = window.scrollY

  const onScroll = (): void => {
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y)
  }
  const stop = (): void => {
    clearTimeout(timer)
    window.removeEventListener('scroll', onScroll)
    READER_INPUT.forEach((type) => window.removeEventListener(type, stop, true))
    if (release === stop) release = null
  }
  const timer = setTimeout(stop, HOLD_MS)

  window.addEventListener('scroll', onScroll, { passive: true })
  READER_INPUT.forEach((type) => window.addEventListener(type, stop, { capture: true, passive: true }))
  release = stop
}
