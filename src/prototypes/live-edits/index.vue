<script setup lang="ts">
import { cdxIconEllipsis, cdxIconHistory } from '@wikimedia/codex-icons'

definePage({
  meta: {
    platform: 'web',
    icon: cdxIconHistory,
  },
})

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CdxIcon, CdxMenuButton, CdxPopover, CdxProgressBar, CdxToast } from '@wikimedia/codex'
import type { MenuGroupData } from '@wikimedia/codex'

import ArticleLive from '@/components/article/ArticleLive.vue'
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import { useWikiPageTitleQuery } from '@/composables/useWikiPageTitleQuery'
import {
  SAVED_PAGES_TEMPLATE_PATH,
  VISUAL_EDITOR_TEMPLATE_PATH,
} from '@/composables/webTemplatePaths'
import { diffUrl, fetchRecentEdits, type RecentEdit } from './fetchRecentEdits'
import { keepScrollPosition } from './keepScrollPosition'
import { useLiveEditsMode, type LiveEditsMode } from './useLiveEditsMode'
import { useFakeUpdate } from './useFakeUpdate'
import UpdateIndicator from './UpdateIndicator.vue'
import VectorStickyHeader from './VectorStickyHeader.vue'

const LIVE_EDITS_PATH = '/live-edits'
/** Wait this long before the first toast, and after each toast goes away. */
const GAP_MS = 5000
/** Twice Codex's default display time. */
const TOAST_MS = 8000
/** Time the pointer can take to move from a change to its popover. */
const POPOVER_CLOSE_MS = 300

const { titleFromQuery, setWikiPageTitle } = useWikiPageTitleQuery()

/** Fixed title from `?title=`; omit prop for random article when absent. */
const article = computed(() => titleFromQuery.value)

function onTitleResolved(title: string) {
  if (title?.trim()) setWikiPageTitle(title)
}

/* Prototype settings, in the overflow menu of the article toolbar. */
const mode = useLiveEditsMode()
const modeItems: MenuGroupData[] = [
  {
    label: 'How edits appear',
    items: [
      { value: 'toast', label: 'Toast' },
      { value: 'live', label: 'Live in article' },
      { value: 'indicator', label: 'Update indicator' },
    ],
  },
]

function onModeSelect(value: LiveEditsMode | null): void {
  if (value) mode.value = value
}

/* Toast mode: the page's real recent edits, newest first, one toast at a time. */
const edits = ref<RecentEdit[]>([])
const nextIndex = ref(0)
const shown = ref<RecentEdit | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined

function scheduleNext(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (!edits.value.length) return
    keepScrollPosition()
    shown.value = edits.value[nextIndex.value % edits.value.length]
    nextIndex.value += 1
  }, GAP_MS)
}

function onToastGone(): void {
  keepScrollPosition()
  shown.value = null
  scheduleNext()
}

watch(
  [titleFromQuery, mode],
  async ([title, current]) => {
    controller?.abort()
    clearTimeout(timer)
    shown.value = null
    edits.value = []
    nextIndex.value = 0
    if (!title || current !== 'toast') return
    controller = new AbortController()
    try {
      const recent = await fetchRecentEdits(title, 50, controller.signal)
      // A toast without a username says nothing, so hidden ones are left out.
      edits.value = recent.filter((edit) => edit.user)
      scheduleNext()
    } catch {
      // Aborted, or the API is unavailable — show no toasts.
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  controller?.abort()
  clearTimeout(timer)
})

/* Scopes the global toast style at the end of this file to this page. */
onMounted(() => document.documentElement.classList.add('protowiki-live-edits'))
onBeforeUnmount(() => document.documentElement.classList.remove('protowiki-live-edits'))

const shownDiffUrl = computed(() =>
  shown.value && titleFromQuery.value ? diffUrl(titleFromQuery.value, shown.value) : '',
)

/** A click anywhere on the toast opens the diff; the link opens it by itself. */
function openDiff(): void {
  window.open(shownDiffUrl.value, '_blank', 'noopener')
  onToastGone()
}

/* Live mode: a made-up edit to the first paragraph comes into the body by itself. */
const liveMode = computed(() => mode.value === 'live')
const liveBody = ref<HTMLElement | null>(null)
const popoverOpen = ref(false)
const popoverAnchor = ref<HTMLElement | null>(null)
/** Page position of the line of the change under the pointer. */
const anchorBox = ref({ top: 0, left: 0, width: 0, height: 0 })
const live = useFakeUpdate(titleFromQuery, liveMode, liveBody, {
  key: 'live',
  auto: true,
  removeSentence: true,
})

/* Indicator mode: a made-up edit, shown in the article after a refresh. */
const indicatorMode = computed(() => mode.value === 'indicator')
const fake = useFakeUpdate(titleFromQuery, indicatorMode, liveBody, { key: 'indicator' })

/**
 * The body this prototype shows instead of the current one: `null` while it
 * loads, `undefined` to keep ArticleLive's.
 */
const customBody = computed(() => {
  if (liveMode.value) return live.html.value
  if (indicatorMode.value) return fake.html.value
  return undefined
})

/** The edit whose changes are marked in the body, in either mode. */
const markedEdit = computed(() => {
  if (liveMode.value) return live.edit.value
  if (indicatorMode.value) return fake.edit.value
  return null
})

/* The popover names the editor of a marked change, while the marks show. */
let closeTimer: ReturnType<typeof setTimeout> | undefined

function changeAt(target: EventTarget | null): HTMLElement | null {
  if (!markedEdit.value || !(target instanceof Element)) return null
  return target.closest<HTMLElement>('.live-change')
}

/**
 * A change that wraps over lines has one box per line. The popover points at
 * the line under the pointer, not at the box around all of them.
 */
function lineBox(change: HTMLElement, x: number, y: number): DOMRect {
  const boxes = Array.from(change.getClientRects())
  const hit = boxes.find(
    (box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom,
  )
  const nearest = boxes.reduce<DOMRect | undefined>((best, box) => {
    const distance = Math.abs((box.top + box.bottom) / 2 - y)
    return !best || distance < Math.abs((best.top + best.bottom) / 2 - y) ? box : best
  }, undefined)
  return hit ?? nearest ?? change.getBoundingClientRect()
}

function cancelClose(): void {
  clearTimeout(closeTimer)
}

async function showPopover(change: HTMLElement, x: number, y: number): Promise<void> {
  cancelClose()
  const box = lineBox(change, x, y)
  const next = {
    top: box.top + window.scrollY,
    left: box.left + window.scrollX,
    width: box.width,
    height: box.height,
  }
  const current = anchorBox.value
  if (popoverOpen.value && next.top === current.top && next.left === current.left) return
  // A moved anchor is not noticed by an open popover, so it opens again in place.
  if (popoverOpen.value) {
    popoverOpen.value = false
    await nextTick()
  }
  anchorBox.value = next
  popoverOpen.value = true
}

function closePopoverSoon(): void {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    popoverOpen.value = false
  }, POPOVER_CLOSE_MS)
}

function onBodyPointerMove(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return
  const change = changeAt(event.target)
  if (change) showPopover(change, event.clientX, event.clientY)
}

function onBodyPointerOut(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || !popoverOpen.value) return
  if (changeAt(event.relatedTarget)) return
  closePopoverSoon()
}

/** Touch has no hover, so a tap on a change opens the popover. */
function onBodyClick(event: MouseEvent): void {
  const change = changeAt(event.target)
  if (change && !(event.target as Element).closest('a')) {
    showPopover(change, event.clientX, event.clientY)
  }
}

/* The marks go with their edit, and so does the popover. */
watch(
  () => markedEdit.value,
  (edit) => {
    if (!edit) popoverOpen.value = false
  },
)

onBeforeUnmount(() => clearTimeout(closeTimer))
</script>

<template>
  <ChromeWrapper :saved-pages-route="SAVED_PAGES_TEMPLATE_PATH">
    <ArticleLive
      :edit-route="VISUAL_EDITOR_TEMPLATE_PATH"
      :wiki-link-route="LIVE_EDITS_PATH"
      :saved-pages-route="SAVED_PAGES_TEMPLATE_PATH"
      :article="article"
      @title-resolved="onTitleResolved"
    >
      <template #page-actions>
        <CdxMenuButton
          :selected="mode"
          :menu-items="modeItems"
          weight="quiet"
          aria-label="Prototype settings"
          title="Prototype settings"
          @update:selected="onModeSelect"
        >
          <CdxIcon :icon="cdxIconEllipsis" />
        </CdxMenuButton>
      </template>

      <template #title-after>
        <UpdateIndicator v-if="fake.pending.value" @refresh="fake.refresh" />
      </template>

      <!-- Live and indicator modes replace the current body with their own. -->
      <template v-if="customBody !== undefined" #default>
        <CdxProgressBar v-if="customBody === null" inline aria-label="Loading the article" />
        <!-- Parsoid HTML from Wikipedia's REST API, with changes marked. -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          v-else
          ref="liveBody"
          class="live-edits__body"
          @pointermove="onBodyPointerMove"
          @pointerout="onBodyPointerOut"
          @click="onBodyClick"
          v-html="customBody"
        />
        <!-- eslint-enable vue/no-v-html -->
      </template>
    </ArticleLive>

    <VectorStickyHeader v-if="titleFromQuery" :title="titleFromQuery">
      <template #title-after>
        <UpdateIndicator v-if="fake.pending.value" @refresh="fake.refresh" />
      </template>
    </VectorStickyHeader>

    <!-- An invisible box over one line of the change, for the popover to point at. -->
    <Teleport to="body">
      <span
        ref="popoverAnchor"
        class="live-edits__anchor"
        aria-hidden="true"
        :style="{
          top: `${anchorBox.top}px`,
          left: `${anchorBox.left}px`,
          width: `${anchorBox.width}px`,
          height: `${anchorBox.height}px`,
        }"
      />
    </Teleport>

    <CdxPopover
      v-model:open="popoverOpen"
      :anchor="popoverAnchor"
      placement="top"
      use-bottom-sheet="never"
    >
      <div
        v-if="markedEdit"
        class="live-edits__popover"
        @mouseenter="cancelClose"
        @mouseleave="closePopoverSoon"
      >
        Edited by <strong>{{ markedEdit.user }}</strong>.
        <!-- The edit is made up, so there is no diff to link to. -->
        <!-- prettier-ignore -->
        <a href="#" @click.prevent>View changes</a>
        <p class="live-edits__editor-stats">
          {{ markedEdit.editCount.toLocaleString('en') }} edits · Contributing for
          {{ markedEdit.contributingFor }}
        </p>
      </div>
    </CdxPopover>

    <CdxToast
      v-if="shown"
      :key="shown.revid"
      :icon="cdxIconHistory"
      type="subtle"
      :auto-dismiss="TOAST_MS"
      @user-dismissed="onToastGone"
      @auto-dismissed="onToastGone"
    >
      <span class="live-edits__toast" @click="openDiff">
        This article was edited by <strong>{{ shown.user }}</strong>.
        <!-- prettier-ignore -->
        <a :href="shownDiffUrl" target="_blank" rel="noopener" @click.stop="onToastGone">View changes</a>
      </span>
    </CdxToast>
  </ChromeWrapper>
</template>

<style scoped>
.live-edits__toast {
  cursor: pointer;
}

.live-edits__editor-stats {
  margin: var(--spacing-25, 4px) 0 0;
  color: var(--color-subtle);
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
}

.live-edits__anchor {
  position: absolute;
  pointer-events: none;
}

/* Added text in green, removed text in red and struck through. */
.live-edits__body :deep(.live-change) {
  cursor: pointer;
}

.live-edits__body :deep(.live-change--added) {
  background-color: var(--background-color-success-subtle);
  text-decoration: none;
}

.live-edits__body :deep(.live-change--removed) {
  background-color: var(--background-color-error-subtle);
  color: var(--color-destructive);
  text-decoration: line-through;
}

</style>

<style>
/*
 * Codex focuses a toast when it appears. These toasts come unasked, so the
 * focus outline makes them look selected; it is hidden. The toast container
 * is teleported to <body>, so the rule hangs off a class on <html> that only
 * this page sets.
 */
.protowiki-live-edits .cdx-toast:focus-visible {
  outline: none;
}
</style>
