<script setup lang="ts">
/**
 * Review changes' diff preview (T440982): one edit's visual diff in a dialog,
 * with its editor, time, chips and edit summary, and the module's list as the
 * queue behind Previous and Next. Past the last edit, Next shows the end
 * message. Undo (T442034) and Thank (T442025) confirm in a popover, then
 * report in a toast.
 *
 * Minerva: fullscreen, as a page of its own — a bar with Back, "Difference"
 * and a "…" menu (Full difference), the article's title, and a bottom bar of
 * Undo, Thank, Back and Next.
 *
 * `index` is the open edit's place in `queue`; null closes the dialog.
 */
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue'
import {
  CdxAccordion,
  CdxButton,
  CdxDialog,
  CdxField,
  CdxIcon,
  CdxInfoChip,
  CdxMenuButton,
  CdxMessage,
  CdxPopover,
  CdxProgressBar,
  CdxTextInput,
  CdxToastContainer,
  useToast,
} from '@wikimedia/codex'
import {
  cdxIconArrowPrevious,
  cdxIconClose,
  cdxIconEditUndo,
  cdxIconEllipsis,
  cdxIconHeart,
  cdxIconLinkExternal,
  cdxIconNext,
  cdxIconPrevious,
} from '@wikimedia/codex-icons'

import { globalSkin } from '@/theme'

import { WIKI_ORIGIN } from './fetchRevisions'
import { REVERTED_CHIP, type ChangeCard } from './loadReviewChanges'
import { useReviewActions } from './useReviewActions'
import { loadVisualDiff, type VisualDiff } from './visualDiff'

const props = defineProps<{
  queue: readonly ChangeCard[]
}>()

const index = defineModel<number | null>('index', { required: true })

const card = computed(() => (index.value === null ? null : (props.queue[index.value] ?? null)))
const revision = computed(() => card.value?.revision ?? null)

const isOpen = computed({
  get: () => card.value !== null,
  set: (open) => {
    if (!open) index.value = null
  },
})

const isMobile = computed(() => globalSkin.value === 'mobile')

/* Minerva's "…" menu. */
const MOBILE_MENU_ITEMS = [
  { value: 'full-diff', label: 'Full difference', icon: cdxIconLinkExternal },
]
const menuSelection = ref<string | number | null>(null)

watch(menuSelection, (value) => {
  if (value === 'full-diff' && card.value) window.open(card.value.href, '_blank', 'noopener')
  menuSelection.value = null
})

/* ---- Queue ---- */

/** Next was pressed on the last edit: the end message shows. */
const atEnd = ref(false)

const hasPrevious = computed(() => (index.value ?? 0) > 0)

function previous(): void {
  atEnd.value = false
  if (index.value !== null && index.value > 0) index.value--
}

function next(): void {
  if (index.value === null) return
  if (index.value < props.queue.length - 1) index.value++
  else atEnd.value = true
}

watch(isOpen, (open) => {
  if (!open) atEnd.value = false
})

/* ---- Metadata ---- */

const RECENT_CHANGES_URL = `${WIKI_ORIGIN}/wiki/Special:RecentChanges`

const pageUrl = (title: string): string =>
  `${WIKI_ORIGIN}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/')}`

const titleUrl = computed(() => (card.value ? pageUrl(card.value.title) : ''))

/** A registered editor's user page; anyone else's contributions. */
const userUrl = computed(() => {
  const rev = revision.value
  if (!rev?.user) return ''
  return rev.registered ? pageUrl(`User:${rev.user}`) : pageUrl(`Special:Contributions/${rev.user}`)
})

/** The full time and date, as MediaWiki writes it ("10:25, 27 November 2026"): a reviewer needs to know when. */
const timestamp = computed(() => {
  if (!revision.value?.timestamp) return ''
  const date = new Date(revision.value.timestamp)
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  return `${time}, ${day}`
})

const { undoneRevids, thankedRevids, thankConfirmed, undo, thank } = useReviewActions()

const isUndone = computed(
  () => !!revision.value && (revision.value.reverted || undoneRevids.has(revision.value.revid)),
)

/** The card's chips, and "Reverted" once the reader has undone the edit. */
const chips = computed(() => {
  if (!card.value) return []
  const undoneHere = revision.value && undoneRevids.has(revision.value.revid)
  return undoneHere && !revision.value!.reverted
    ? [REVERTED_CHIP, ...card.value.chips]
    : card.value.chips
})

/* ---- Edit summary: two lines, then a disclosure ---- */

const summaryEl = useTemplateRef<HTMLElement>('summary')
/** The summary runs past its two lines. */
const canExpandSummary = ref(false)
const isSummaryExpanded = ref(false)

/** Only the plain summary carries the ref, so each edit is measured there before it moves into the accordion. */
function measureSummary(): void {
  const el = summaryEl.value
  if (!el || isSummaryExpanded.value) return
  canExpandSummary.value = el.scrollHeight > el.clientHeight
}

watch(
  () => card.value?.key,
  () => {
    isSummaryExpanded.value = false
    canExpandSummary.value = false
    void nextTick(measureSummary)
  },
)

/* ---- Visual diff ---- */

const diff = ref<VisualDiff | null>(null)
const diffLoading = ref(false)
const diffError = ref(false)
/** Too large to compare. */
const diffUnavailable = ref(false)

let diffController: AbortController | null = null

async function loadDiff(): Promise<void> {
  diffController?.abort()
  diff.value = null
  diffError.value = false
  diffUnavailable.value = false
  const rev = revision.value
  if (!rev) {
    diffLoading.value = false
    return
  }
  const controller = new AbortController()
  diffController = controller
  diffLoading.value = true
  try {
    const result = await loadVisualDiff(rev.revid, rev.parentid, controller.signal)
    if (controller.signal.aborted) return
    diff.value = result
    diffUnavailable.value = result === null
  } catch (error) {
    if (controller.signal.aborted) return
    console.error(error)
    diffError.value = true
  } finally {
    if (diffController === controller) diffLoading.value = false
  }
}

watch(() => revision.value?.revid, loadDiff, { immediate: true })
onBeforeUnmount(() => diffController?.abort())

/* ---- Undo and Thank ---- */

const toast = useToast()

const undoButton = useTemplateRef<InstanceType<typeof CdxButton>>('undoButton')
const thankButton = useTemplateRef<InstanceType<typeof CdxButton>>('thankButton')

const undoOpen = ref(false)
const undoReason = ref('')
const thankOpen = ref(false)

/** MediaWiki's own undo summary, which the reader's reason follows. */
const undoSummary = computed(() => {
  const rev = revision.value
  if (!rev) return ''
  const standard = `Undid revision ${rev.revid} by ${rev.user || 'Anonymous'} (talk)`
  const reason = undoReason.value.trim()
  return reason ? `${standard} ${reason}` : standard
})

function onUndo(): void {
  if (isUndone.value) {
    toast.error('This edit has already been undone.', { autoDismiss: true })
    return
  }
  undoReason.value = ''
  undoOpen.value = true
}

function confirmUndo(): void {
  if (!revision.value) return
  undo(revision.value.revid)
  undoOpen.value = false
  toast.success('Edit undone.', { autoDismiss: true })
}

const editorName = computed(() => revision.value?.user || 'this editor')

function sendThanks(): void {
  if (!revision.value) return
  thank(revision.value.revid)
  thankOpen.value = false
  toast.success(`Thanks sent to ${editorName.value}.`, { autoDismiss: true })
}

/** The first thanks asks first; later ones go at once. */
function onThank(): void {
  if (!revision.value) return
  if (thankedRevids.has(revision.value.revid)) {
    toast.info(`You already thanked ${editorName.value}.`, { autoDismiss: true })
    return
  }
  if (thankConfirmed.value) sendThanks()
  else thankOpen.value = true
}

/* Each edit starts with its popovers shut. */
watch(
  () => card.value?.key,
  () => {
    undoOpen.value = false
    thankOpen.value = false
  },
)
</script>

<template>
  <CdxDialog
    v-model:open="isOpen"
    class="home-diff-preview"
    :class="{ 'home-diff-preview--mobile': isMobile }"
    :title="card ? `Difference: ${card.title}` : ''"
    use-close-button
  >
    <!-- The header slot replaces Codex's whole header, so the close button is rebuilt here. -->
    <template #header>
      <div v-if="isMobile" class="home-diff-preview__bar">
        <CdxButton weight="quiet" aria-label="Back" @click="isOpen = false">
          <CdxIcon :icon="cdxIconArrowPrevious" />
        </CdxButton>
        <h2 class="home-diff-preview__bar-title">Difference</h2>
        <CdxMenuButton
          v-model:selected="menuSelection"
          :menu-items="MOBILE_MENU_ITEMS"
          aria-label="More options"
        >
          <CdxIcon :icon="cdxIconEllipsis" />
        </CdxMenuButton>
      </div>
      <div v-else class="cdx-dialog__header__title-group">
        <h2 class="cdx-dialog__header__title home-diff-preview__title">
          Difference:
          <a v-if="card" :href="titleUrl" target="_blank" rel="noopener">{{ card.title }}</a>
        </h2>
      </div>
      <CdxButton
        v-if="!isMobile"
        class="cdx-dialog__header__close-button"
        weight="quiet"
        aria-label="Close"
        @click="isOpen = false"
      >
        <CdxIcon :icon="cdxIconClose" />
      </CdxButton>
    </template>

    <template v-if="card && revision">
      <div class="home-diff-preview__top">
        <h1 v-if="isMobile" class="home-diff-preview__page-title">
          <a :href="titleUrl" target="_blank" rel="noopener">{{ card.title }}</a>
        </h1>

        <div class="home-diff-preview__meta">
          <a
            v-if="userUrl"
            class="home-diff-preview__user"
            :href="userUrl"
            target="_blank"
            rel="noopener"
          >
            {{ revision.user }}
          </a>
          <span v-else>{{ card.user }}</span>
          <span>{{ timestamp }}</span>
        </div>

        <div v-if="chips.length" class="home-diff-preview__chips">
          <CdxInfoChip
            v-for="chip in chips"
            :key="chip.label"
            :status="chip.status"
            :icon="chip.icon"
          >
            {{ chip.label }}
          </CdxInfoChip>
        </div>

        <div class="home-diff-preview__summary">
          <CdxAccordion
            v-if="canExpandSummary"
            v-model="isSummaryExpanded"
            class="home-diff-preview__summary-accordion"
            separation="none"
            heading-level="h3"
          >
            <template #title>
              <span
                class="home-diff-preview__summary-text"
                :class="{ 'home-diff-preview__summary-text--clamped': !isSummaryExpanded }"
              >
                {{ card.summary }}
              </span>
            </template>
          </CdxAccordion>
          <span
            v-else
            ref="summary"
            class="home-diff-preview__summary-text home-diff-preview__summary-text--clamped"
          >
            {{ card.summary }}
          </span>
        </div>
      </div>

      <CdxProgressBar v-if="diffLoading" inline aria-label="Loading the change" />

      <CdxMessage v-else-if="diffError" type="error">
        This change could not be previewed.
        <a :href="card.href" target="_blank" rel="noopener">View the full difference</a>
      </CdxMessage>

      <CdxMessage v-else-if="diffUnavailable">
        A preview is not available for this change.
        <a :href="card.href" target="_blank" rel="noopener">View the full difference</a>
      </CdxMessage>

      <CdxMessage v-else-if="diff && !diff.html">
        This edit changed no article text: template, link and category changes don't show here.
        <a :href="card.href" target="_blank" rel="noopener">View the full difference</a>
      </CdxMessage>

      <template v-else-if="diff">
        <!-- eslint-disable-next-line vue/no-v-html -- Wikipedia's own article HTML, scripts and styles stripped. -->
        <div class="home-visual-diff" v-html="diff.html" />
        <p v-if="diff.truncated && isMobile" class="home-diff-preview__full-diff">
          More changes aren't shown.
        </p>
        <!-- Minerva: Full difference is in the "…" menu. -->
        <p v-if="!isMobile" class="home-diff-preview__full-diff">
          <template v-if="diff.truncated">More changes aren't shown. </template>
          <a :href="card.href" target="_blank" rel="noopener">
            View the full difference
            <CdxIcon :icon="cdxIconLinkExternal" size="small" />
          </a>
        </p>
      </template>

      <!-- Sticky, so it holds the foot of the diff however far the reader has scrolled. -->
      <CdxMessage
        v-if="atEnd"
        class="home-diff-preview__end"
        type="success"
        fade-in
        allow-user-dismiss
        @user-dismissed="atEnd = false"
      >
        <p class="home-diff-preview__end-title">No further changes.</p>
        <p>
          Check back later for new changes, explore all
          <a :href="RECENT_CHANGES_URL" target="_blank" rel="noopener">recent changes</a>, or return
          to
          <button type="button" class="home-diff-preview__end-home" @click="isOpen = false">
            Home</button
          >.
        </p>
      </CdxMessage>
    </template>

    <template #footer>
      <!-- Minerva: one bar, icons over labels. -->
      <div v-if="isMobile" class="home-diff-preview__bottom-bar">
        <CdxButton
          ref="undoButton"
          class="home-diff-preview__bar-button"
          weight="quiet"
          @click="onUndo"
        >
          <CdxIcon :icon="cdxIconEditUndo" />
          Undo
        </CdxButton>
        <CdxButton
          ref="thankButton"
          class="home-diff-preview__bar-button"
          weight="quiet"
          :disabled="!revision?.registered"
          @click="onThank"
        >
          <CdxIcon :icon="cdxIconHeart" />
          Thank
        </CdxButton>
        <CdxButton
          class="home-diff-preview__bar-button"
          weight="quiet"
          :disabled="!hasPrevious"
          @click="previous"
        >
          <CdxIcon :icon="cdxIconPrevious" />
          Back
        </CdxButton>
        <CdxButton
          class="home-diff-preview__bar-button"
          weight="quiet"
          :disabled="atEnd"
          @click="next"
        >
          <CdxIcon :icon="cdxIconNext" />
          Next
        </CdxButton>
      </div>

      <div v-else class="home-diff-preview__footer">
        <div class="home-diff-preview__actions">
          <CdxButton ref="undoButton" @click="onUndo">
            <CdxIcon :icon="cdxIconEditUndo" />
            Undo
          </CdxButton>
          <CdxButton
            ref="thankButton"
            :disabled="!revision?.registered"
            :title="revision?.registered ? undefined : 'Only registered accounts can be thanked'"
            @click="onThank"
          >
            <CdxIcon :icon="cdxIconHeart" />
            Thank
          </CdxButton>
        </div>

        <div class="home-diff-preview__nav">
          <!-- Icon-only buttons, so each needs an accessible name. -->
          <CdxButton aria-label="Previous change" :disabled="!hasPrevious" @click="previous">
            <CdxIcon :icon="cdxIconPrevious" />
          </CdxButton>
          <CdxButton aria-label="Next change" :disabled="atEnd" @click="next">
            <CdxIcon :icon="cdxIconNext" />
          </CdxButton>
        </div>
      </div>

      <CdxPopover
        v-model:open="undoOpen"
        :anchor="undoButton"
        title="Undo this edit?"
        use-close-button
        placement="top-start"
        :use-bottom-sheet="isMobile ? 'always' : 'never'"
        :primary-action="{ label: 'Undo', actionType: 'destructive' }"
        :default-action="{ label: 'Cancel' }"
        @primary="confirmUndo"
        @default="undoOpen = false"
      >
        <CdxField>
          <template #label>Edit summary (optional)</template>
          <template #help-text>Saved as: {{ undoSummary }}</template>
          <CdxTextInput v-model="undoReason" placeholder="Why are you undoing this edit?" />
        </CdxField>
      </CdxPopover>

      <CdxPopover
        v-model:open="thankOpen"
        :anchor="thankButton"
        title="Send thanks?"
        use-close-button
        placement="top-start"
        :use-bottom-sheet="isMobile ? 'always' : 'never'"
        :primary-action="{ label: 'Send thanks', actionType: 'progressive' }"
        :default-action="{ label: 'Cancel' }"
        @primary="sendThanks"
        @default="thankOpen = false"
      >
        Send public thanks to {{ editorName }} for this edit?
      </CdxPopover>
    </template>
  </CdxDialog>

  <CdxToastContainer />
</template>

<style>
/*
 * Unscoped: the dialog renders through a teleport, so its own element takes no
 * scope. Wider than Codex's default (--size-3200): a visual diff needs the room.
 * The header slot drops Codex's header layout class, so the header lays itself out.
 */
.home-diff-preview.cdx-dialog {
  max-width: var(--size-4000);
}

.home-diff-preview .cdx-dialog__header {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  box-sizing: border-box;
  width: 100%;
}

/* Minerva: fullscreen, edge to edge, like a page. */
.home-diff-preview--mobile.cdx-dialog {
  width: 100vw;
  max-width: none;
  height: 100dvh;
  max-height: none;
  border: 0;
  border-radius: 0;
}

/* The bar: 48px, a hairline under it, as the module pages' bar. */
.home-diff-preview--mobile .cdx-dialog__header {
  padding: var(--spacing-50);
  box-shadow: 0 1px 0 var(--border-color-base);
}

/* The bottom bar runs edge to edge, with a hairline over it. */
.home-diff-preview--mobile .cdx-dialog__footer {
  padding: 0;
  border-top: var(--border-width-base) var(--border-style-base) var(--border-color-base);
}
</style>

<style scoped>
/* The heading reads as a heading, not as a link. */
.home-diff-preview__title a,
.home-diff-preview__page-title a {
  color: inherit;
}

/* Minerva's bar: Back, the title centred, the "…" menu. */
.home-diff-preview__bar {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--spacing-50);
}

/* Codex Body bold, as the module pages' bar title. */
.home-diff-preview__bar-title {
  flex: 1;
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-medium);
  text-align: center;
}

/* The article's title as Minerva's page heading: serif, a rule under it. */
.home-diff-preview__page-title {
  margin: 0 0 var(--spacing-75);
  border-bottom: var(--border-width-base) var(--border-style-base) var(--border-color-base);
  font-family: var(--font-family-serif);
  font-size: 1.8rem;
  font-weight: var(--font-weight-normal);
  line-height: 1.375;
}

/* The edit's details, ruled off from the diff. */
.home-diff-preview__top {
  margin-bottom: var(--spacing-75);
  padding-bottom: var(--spacing-25);
  border-bottom: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
}

.home-diff-preview__meta,
.home-diff-preview__chips,
.home-diff-preview__summary {
  margin-bottom: var(--spacing-50);
}

/* The editor on the left, the time on the right. */
.home-diff-preview__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-25);
  color: var(--color-subtle);
}

.home-diff-preview__user {
  font-weight: var(--font-weight-bold);
}

.home-diff-preview__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-25);
}

/* The editor's own words, set apart from the dialog's. In regular weight, though the accordion's title is a heading. */
.home-diff-preview__summary-text {
  font-weight: var(--font-weight-normal);
  color: var(--color-subtle);
  font-style: italic;
}

.home-diff-preview__summary-text--clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* No chrome of its own: the summary stays in the text column, only the arrow outside it. */
.home-diff-preview__summary-accordion :deep(summary) {
  padding-inline: 0;
}

.home-diff-preview__full-diff {
  margin: var(--spacing-75) 0 0;
  color: var(--color-subtle);
}

/* The dialog body scrolls; the end message holds its foot. */
.home-diff-preview__end.cdx-message {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin-top: var(--spacing-50);
}

.home-diff-preview__end p {
  margin: 0;
}

.home-diff-preview__end .home-diff-preview__end-title {
  font-weight: var(--font-weight-bold);
}

/* A button, because it closes the dialog, but it reads as the link beside it. */
.home-diff-preview__end-home {
  padding: 0;
  border: 0;
  background-color: transparent;
  color: var(--color-progressive);
  font: inherit;
  cursor: pointer;
}

.home-diff-preview__end-home:hover {
  text-decoration: underline;
}

/* Minerva: four equal buttons, each icon over its label. */
.home-diff-preview__bottom-bar {
  display: flex;
  width: 100%;
}

.home-diff-preview__bar-button.cdx-button {
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-12);
  max-width: none;
  height: auto;
  padding: var(--spacing-50) 0;
  border-radius: 0;
  font-size: var(--font-size-small);
  font-weight: var(--font-weight-normal);
  line-height: var(--line-height-small);
}

/* Undo and Thank at the start, Previous and Next at the end. */
.home-diff-preview__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-50);
  width: 100%;
}

.home-diff-preview__actions,
.home-diff-preview__nav {
  display: flex;
  gap: var(--spacing-50);
}

/* ---- The visual diff (article HTML, so unscoped within it) ---- */

.home-visual-diff :deep(.home-visual-diff__section) {
  margin: var(--spacing-100) 0 var(--spacing-25);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-subtle);
}

.home-visual-diff :deep(.home-visual-diff__section:first-child) {
  margin-top: 0;
}

.home-visual-diff :deep(p),
.home-visual-diff :deep(ul),
.home-visual-diff :deep(ol),
.home-visual-diff :deep(div[class*='home-visual-diff__block']) {
  margin: 0 0 var(--spacing-50);
}

.home-visual-diff :deep(h2),
.home-visual-diff :deep(h3),
.home-visual-diff :deep(h4),
.home-visual-diff :deep(h5),
.home-visual-diff :deep(h6) {
  margin: 0 0 var(--spacing-50);
}

/* A whole block added or removed. */
.home-visual-diff :deep(.home-visual-diff__block--added) {
  background-color: var(--background-color-success-subtle);
}

.home-visual-diff :deep(.home-visual-diff__block--removed) {
  background-color: var(--background-color-error-subtle);
  text-decoration: line-through;
}

/* Words added or removed within a changed block. */
.home-visual-diff :deep(ins.live-change--added) {
  background-color: var(--background-color-success-subtle);
  text-decoration: none;
}

.home-visual-diff :deep(del.live-change--removed) {
  background-color: var(--background-color-error-subtle);
  text-decoration: line-through;
}

.home-visual-diff :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
