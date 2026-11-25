import { computed, ref } from 'vue'

/* Its own key, so the choice doesn't leak into other prototypes. */
const STORAGE_KEY = 'protowiki-live-edits-mode-v1'

/** How the prototype tells the reader about an edit. */
export type LiveEditsMode = 'toast' | 'live' | 'indicator'

const MODES: LiveEditsMode[] = ['toast', 'live', 'indicator']

function loadMode(): LiveEditsMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return MODES.includes(stored as LiveEditsMode) ? (stored as LiveEditsMode) : 'toast'
  } catch {
    // Unavailable storage — use the default.
    return 'toast'
  }
}

const current = ref<LiveEditsMode>(loadMode())

/** The chosen mode, kept in localStorage. */
export function useLiveEditsMode() {
  return computed({
    get: () => current.value,
    set: (value: LiveEditsMode) => {
      current.value = value
      try {
        window.localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // Quota or private mode — the choice still works for this visit.
      }
    },
  })
}
