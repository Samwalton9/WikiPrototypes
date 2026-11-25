<script setup lang="ts">
/**
 * Vector 2022's sticky header: once the page title scrolls out of view, a bar
 * at the top of the window shows the title and the main page actions. Desktop
 * only, as in production. The page actions are mocks.
 */
import {
  cdxIconEdit,
  cdxIconHistory,
  cdxIconSearch,
  cdxIconSpeechBubbles,
  cdxIconStar,
} from '@wikimedia/codex-icons'
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useSkin } from '@/composables/useSkin'

defineProps<{
  title: string
}>()

const skin = useSkin()
const titleOutOfView = ref(false)
const visible = computed(() => skin.value === 'desktop' && titleOutOfView.value)

/** The article's `h1`, rendered by ArticleHeader. */
function onScroll(): void {
  const heading = document.querySelector('.article-header__title')
  titleOutOfView.value = heading ? heading.getBoundingClientRect().bottom < 0 : false
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))

function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const ACTIONS = [
  { label: 'Talk', icon: cdxIconSpeechBubbles },
  { label: 'View history', icon: cdxIconHistory },
  { label: 'Watch', icon: cdxIconStar },
  { label: 'Edit', icon: cdxIconEdit },
]
</script>

<template>
  <Transition name="sticky-header">
    <div v-if="visible" class="sticky-header">
      <div class="sticky-header__start">
        <CdxButton weight="quiet" aria-label="Search Wikipedia" title="Search Wikipedia">
          <CdxIcon :icon="cdxIconSearch" />
        </CdxButton>
        <a href="#" class="sticky-header__title" @click.prevent="scrollToTop">{{ title }}</a>
        <slot name="title-after" />
      </div>
      <div class="sticky-header__end">
        <CdxButton
          v-for="action in ACTIONS"
          :key="action.label"
          weight="quiet"
          :aria-label="action.label"
          :title="action.label"
        >
          <CdxIcon :icon="action.icon" />
        </CdxButton>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sticky-header {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-100, 16px);
  height: 50px;
  padding: 0 var(--spacing-100, 16px);
  box-sizing: border-box;
  background-color: var(--background-color-base);
  border-bottom: var(--border-width-base, 1px) solid var(--border-color-subtle);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
}

.sticky-header__start {
  display: flex;
  align-items: center;
  gap: var(--spacing-50, 8px);
  min-width: 0;
}

.sticky-header__title {
  overflow: hidden;
  min-width: 0;
  color: var(--color-base);
  font-family: var(--font-family-serif);
  font-size: 1.5rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.sticky-header__title:hover {
  text-decoration: none;
}

.sticky-header__start > :deep(*:last-child:not(.sticky-header__title)) {
  flex-shrink: 0;
}

.sticky-header__end {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.sticky-header__end .cdx-icon {
  color: var(--color-subtle);
}

.sticky-header-enter-active,
.sticky-header-leave-active {
  transition:
    transform 150ms ease,
    opacity 150ms ease;
}

.sticky-header-enter-from,
.sticky-header-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
