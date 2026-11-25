/**
 * A made-up edit to the article's first paragraph. Some seconds after the
 * article loads, the edit "happens". In the "update indicator" mode the page
 * shows an indicator, and a refresh swaps in the new version. In the "live"
 * mode the new version comes in at once. Either way, the changes stay marked.
 * Each mode makes its edit once for each load of the prototype.
 */
import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

import { fetchArticleBody } from '@/components/article/shared/fetchArticleBody'
import { WIKI_HOST } from './fetchRecentEdits'
import { markWords } from './diffRevisions'
import { editParagraph, leadParagraph } from './fakeEdit'

/** Time from the article load to the made-up edit. */
const EDIT_DELAY_MS = 5000
/** The made-up editor, described in the popover on the change. */
export interface FakeEditor {
  user: string
  editCount: number
  /** How long the editor has contributed, as the popover shows it. */
  contributingFor: string
}

const EDITOR: FakeEditor = {
  user: 'ExampleEditor',
  editCount: 1284,
  contributingFor: '6 years',
}

/* Module scope: a new load of the prototype resets it, a new article does not. */
const editsMade = new Set<string>()

export interface FakeUpdateOptions {
  /** Its own "once per load"; modes with different keys each make their edit. */
  key: string
  /** Apply the edit when it happens, with no indicator and no refresh. */
  auto?: boolean
  /** Also remove a sentence from the paragraph, so that the edit shows a removal. */
  removeSentence?: boolean
}

export function useFakeUpdate(
  title: Ref<string | null | undefined>,
  enabled: Ref<boolean>,
  /** The element that shows `html`; the edit changes its first paragraph in place. */
  container: Ref<HTMLElement | null>,
  options: FakeUpdateOptions,
) {
  /** The body to show; `null` while it loads. */
  const html = ref<string | null>(null)
  /** True while a new edit waits for a refresh. */
  const pending = ref(false)
  /** The edit whose change is marked, after it is applied. */
  const edit = ref<FakeEditor | null>(null)

  let controller: AbortController | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  watch(
    [title, enabled],
    async ([page, on]) => {
      controller?.abort()
      clearTimeout(timer)
      html.value = null
      pending.value = false
      edit.value = null
      if (!page || !on) return
      controller = new AbortController()
      const { signal } = controller
      try {
        const body = await fetchArticleBody(page, WIKI_HOST, { signal })
        if (signal.aborted) return
        html.value = body.html
      } catch {
        // Aborted, or the API is unavailable — ArticleLive shows the error.
        return
      }
      if (editsMade.has(options.key)) return
      timer = setTimeout(() => {
        editsMade.add(options.key)
        if (options.auto) apply()
        else pending.value = true
      }, EDIT_DELAY_MS)
    },
    { immediate: true },
  )

  /**
   * Swaps in the edited first paragraph, with the changes marked. Only that
   * paragraph changes; the rest of the article stays as it is.
   */
  function apply(): void {
    const lead = container.value ? leadParagraph(container.value) : undefined
    if (!lead || !title.value) return
    const edited = lead.cloneNode(true) as HTMLParagraphElement
    editParagraph(edited, title.value, Boolean(options.removeSentence))
    markWords(lead, edited)
    lead.replaceWith(edited)
    edit.value = EDITOR
  }

  /** The reader asked for the new version: show it, and bring the change into view. */
  function refresh(): void {
    if (!pending.value) return
    pending.value = false
    apply()
    container.value
      ?.querySelector('.live-change')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  onBeforeUnmount(() => {
    controller?.abort()
    clearTimeout(timer)
  })

  return { html, pending, edit, refresh }
}
