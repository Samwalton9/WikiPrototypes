<script setup lang="ts">
/**
 * The Review changes module's body: the latest edit to each of the reader's
 * pages, newest first, flagged for review. Only shown to readers with pages
 * (see `index.vue`). Two tabs: "Your pages", those edits; and "Abuse review",
 * the wiki's recent article edits (see `loadAbuseReview`). On the Home each tab
 * shows three cards and a "Show more"; as a `feed` (its own page) every change,
 * as divider rows. A card opens its edit in the diff preview, with the tab's
 * whole list as the queue; opened cards show as read.
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxTab, CdxTabs } from '@wikimedia/codex'

import HomeChangeCards from './HomeChangeCards.vue'
import HomeDiffPreview from './HomeDiffPreview.vue'
import HomeShowMore from './HomeShowMore.vue'
import { loadAbuseReview, loadReviewChanges, type ChangeCard } from './loadReviewChanges'
import { useHomeSeeds } from './useHomeSeeds'
import { useModuleLoad } from './useModuleLoad'

const props = defineProps<{
  /** The module's own page: every change, as a feed. */
  feed?: boolean
}>()

/** Cards shown at first, and revealed by each "Show more". */
const PAGE_SIZE = 3

const { seeds } = useHomeSeeds()

const seedsKey = () => seeds.value.join('\n')
const {
  items: changes,
  loading,
  error,
  reload,
} = useModuleLoad(seedsKey, (signal) => loadReviewChanges(seeds.value, signal))

const {
  items: abuseChanges,
  loading: abuseLoading,
  error: abuseError,
  reload: reloadAbuse,
} = useModuleLoad(
  () => 'abuse-review',
  (signal) => loadAbuseReview(signal),
)

type Tab = 'your-pages' | 'abuse-review'
const activeTab = ref<Tab>('your-pages')

const isAbuseTab = computed(() => activeTab.value === 'abuse-review')
const tabChanges = computed(() => (isAbuseTab.value ? abuseChanges.value : changes.value))
const tabLoading = computed(() => (isAbuseTab.value ? abuseLoading.value : loading.value))
const tabError = computed(() => (isAbuseTab.value ? abuseError.value : error.value))

function retry(): void {
  void (isAbuseTab.value ? reloadAbuse() : reload())
}

/** The open edit's place in the tab's list, or null with the preview shut. */
const previewIndex = ref<number | null>(null)
/** Cards opened in this visit, by key: the preview marks each one it shows. */
const openedKeys = ref(new Set<string>())

function openPreview(card: ChangeCard): void {
  previewIndex.value = tabChanges.value.findIndex((other) => other.key === card.key)
}

watch(previewIndex, (index) => {
  const card = index === null ? undefined : tabChanges.value[index]
  if (card && !openedKeys.value.has(card.key)) {
    openedKeys.value = new Set(openedKeys.value).add(card.key)
  }
})

const shown = ref(PAGE_SIZE)
// New pages to grow from, or another tab, start back at the first cards.
watch([seedsKey, activeTab], () => {
  shown.value = PAGE_SIZE
})

const visible = computed(() =>
  props.feed ? tabChanges.value : tabChanges.value.slice(0, shown.value),
)
const hasMore = computed(() => shown.value < tabChanges.value.length)
const expanded = computed(() => shown.value > PAGE_SIZE)

const root = ref<HTMLElement | null>(null)

/** Fold back, and bring the module into view if the reader had scrolled past it. */
function collapse(): void {
  shown.value = PAGE_SIZE
  const el = root.value
  if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start' })
}
</script>

<template>
  <div ref="root" class="home-review-changes">
    <CdxTabs v-model:active="activeTab" class="home-review-changes__tabs">
      <CdxTab name="your-pages" label="Your pages" />
      <CdxTab name="abuse-review" label="Abuse review" />
    </CdxTabs>

    <div v-if="tabError" class="home-review-changes__error">
      <p>Couldn't load this section.</p>
      <CdxButton weight="quiet" @click="retry">Try again</CdxButton>
    </div>

    <p v-else-if="!tabLoading && !tabChanges.length" class="home-review-changes__empty">
      Nothing here right now.
    </p>

    <template v-else>
      <HomeChangeCards
        :cards="visible"
        :loading="tabLoading"
        :skeletons="PAGE_SIZE"
        :feed="feed"
        :opened-keys="openedKeys"
        @open="openPreview"
      />

      <HomeShowMore
        v-if="!feed"
        module="review-changes"
        :has-more="hasMore"
        :expanded="expanded"
        :disabled="tabLoading"
        @more="shown += PAGE_SIZE"
        @collapse="collapse"
      />
    </template>

    <HomeDiffPreview v-model:index="previewIndex" :queue="tabChanges" />
  </div>
</template>

<style scoped>
.home-review-changes__tabs {
  margin-bottom: var(--spacing-75);
}

.home-review-changes__error,
.home-review-changes__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-50);
  margin: 0;
  color: var(--color-subtle);
}

.home-review-changes__error p {
  margin: 0;
}
</style>
