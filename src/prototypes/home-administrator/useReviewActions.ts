import { reactive, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const THANK_CONFIRMED_KEY = 'protowiki-home-administrator-thank-confirmed-v1'

function loadThankConfirmed(): boolean {
  try {
    return window.localStorage.getItem(THANK_CONFIRMED_KEY) === '1'
  } catch {
    return false
  }
}

// Module-level: the Home and the module's own page share them.
/** Edits the reader undid in this visit, by revision. */
const undoneRevids = reactive(new Set<number>())
/** Edits the reader thanked for in this visit, by revision. */
const thankedRevids = reactive(new Set<number>())
/** The reader has confirmed one thanks, so later thanks go without asking. */
const thankConfirmed = ref<boolean | undefined>(undefined)

/**
 * Undo and Thank from the Review changes preview.
 *
 * PROTOWIKI+ The prototype can't edit the wiki or send thanks. Each action
 * only records itself here, so the preview acts as if it happened.
 */
export function useReviewActions() {
  if (thankConfirmed.value === undefined) thankConfirmed.value = loadThankConfirmed()

  function undo(revid: number): void {
    undoneRevids.add(revid)
  }

  function thank(revid: number): void {
    thankedRevids.add(revid)
    if (thankConfirmed.value) return
    thankConfirmed.value = true
    try {
      setItemKeepingState(THANK_CONFIRMED_KEY, '1')
    } catch (error) {
      // Quota or private mode — the next thanks asks again after a reload.
      console.warn(`[ProtoWiki][Review changes] Couldn't save the thanks choice:`, error)
    }
  }

  return { undoneRevids, thankedRevids, thankConfirmed, undo, thank }
}
