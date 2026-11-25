import { computed, ref } from 'vue'

import { setItemKeepingState } from '@/utils/storage'

/* Its own key, so this template's state doesn't leak into other prototypes'. */
const STORAGE_KEY = 'protowiki-home-administrator-todos-v1'

/** One task in the To-do module. */
export interface Todo {
  id: string
  /** Free text. `[[Page]]` and `[[Page|text]]` become links to the wiki. */
  text: string
  /** When it was ticked (ISO 8601); empty while it's open. */
  completedAt: string
}

function newTodoId(): string {
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Complete entries only, each id once. */
function normalize(value: unknown): Todo[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((entry) => {
    const record =
      typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : {}
    const { id, text, completedAt } = record
    if (typeof id !== 'string' || !id || seen.has(id)) return []
    if (typeof text !== 'string' || !text.trim() || typeof completedAt !== 'string') return []
    seen.add(id)
    return [{ id, text: text.trim(), completedAt }]
  })
}

function load(): Todo[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalize(JSON.parse(raw)) : []
  } catch {
    // Unavailable storage or corrupt JSON — start with no tasks.
    return []
  }
}

// Module-level: the module and its "…" menu read the same list.
const todos = ref<Todo[] | null>(null)

/**
 * The reader's to-do list, kept in localStorage: open tasks in the reader's
 * order, and completed ones, newest first. Every change saves at once.
 */
export function useTodos() {
  todos.value ??= load()

  function persist(next: Todo[]): void {
    todos.value = next
    try {
      setItemKeepingState(STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      // Quota or private mode — the tasks still work for this visit, but won't last a reload.
      console.warn(`[ProtoWiki][To-do] Couldn't save the tasks:`, error)
    }
  }

  const all = computed(() => todos.value ?? [])
  const open = computed(() => all.value.filter((todo) => !todo.completedAt))
  const completed = computed(() =>
    all.value
      .filter((todo) => todo.completedAt)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  )

  /** A new task, at the end of the open ones. */
  function add(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    persist([...all.value, { id: newTodoId(), text: trimmed, completedAt: '' }])
  }

  function update(id: string, text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    persist(all.value.map((todo) => (todo.id === id ? { ...todo, text: trimmed } : todo)))
  }

  /** Tick a task (it goes to Completed), or untick it (back to the end of the open ones). */
  function setDone(id: string, done: boolean): void {
    const todo = all.value.find((item) => item.id === id)
    if (!todo) return
    const rest = all.value.filter((item) => item.id !== id)
    persist([...rest, { ...todo, completedAt: done ? new Date().toISOString() : '' }])
  }

  function remove(id: string): void {
    persist(all.value.filter((todo) => todo.id !== id))
  }

  function clearCompleted(): void {
    persist(open.value)
  }

  /** Move the open task at `from` to `to` (open tasks' places). */
  function moveOpen(from: number, to: number): void {
    const reordered = [...open.value]
    const [todo] = reordered.splice(from, 1)
    reordered.splice(to, 0, todo)
    persist([...reordered, ...all.value.filter((item) => item.completedAt)])
  }

  return { open, completed, add, update, setDone, remove, clearCompleted, moveOpen }
}

/** A task's text in parts: plain text, and `[[Page]]` / `[[Page|text]]` links. */
export function todoParts(text: string): ({ text: string } | { text: string; href: string })[] {
  const parts: ({ text: string } | { text: string; href: string })[] = []
  const pattern = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    const page = match[1].trim()
    const path = encodeURIComponent(page.replace(/ /g, '_'))
      .replace(/%2F/g, '/')
      .replace(/%3A/g, ':')
    parts.push({ text: (match[2] ?? page).trim(), href: `https://en.wikipedia.org/wiki/${path}` })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}
