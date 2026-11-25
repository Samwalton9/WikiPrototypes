import { computed, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

import { useBacklogConfig } from './useBacklogConfig'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-backlogs-v1'

/** The most backlogs the module shows at once. */
export const MAX_BACKLOGS = 3

/** Strings only, each once. */
function normalizeIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return [...new Set(value.filter((id): id is string => typeof id === 'string'))]
}

function loadIds(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeIds(JSON.parse(raw)) : null
  } catch {
    // Unavailable storage or corrupt JSON — start from the defaults.
    return null
  }
}

// Module-level: the module's menu, its dialog and its body read the same choice.
// `null` until the reader chooses: the configured list's first three.
const ids = ref<string[] | null | undefined>(undefined)

/**
 * The backlogs the reader has turned on for the Backlogs module, kept in
 * localStorage: at most {@link MAX_BACKLOGS}, from those Community
 * Configuration offers. A backlog the configuration drops goes from the choice too.
 */
export function useBacklogSelection() {
  if (ids.value === undefined) ids.value = loadIds()
  const { backlogs } = useBacklogConfig()

  const enabled = computed(() => {
    const chosen = ids.value
    const found = chosen
      ? backlogs.value.filter((backlog) => chosen.includes(backlog.id))
      : backlogs.value
    return found.slice(0, MAX_BACKLOGS)
  })
  const enabledIds = computed(() => enabled.value.map((backlog) => backlog.id))

  function setEnabled(next: readonly string[]): void {
    ids.value = normalizeIds(next)?.slice(0, MAX_BACKLOGS) ?? []
    try {
      setItemKeepingState(STORAGE_KEY, JSON.stringify(ids.value))
    } catch {
      // Quota or private mode — the in-memory choice still works for this visit.
    }
  }

  return { enabledIds, enabled, setEnabled }
}
