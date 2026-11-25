<script setup lang="ts">
/**
 * The Active discussions module's body: busy noticeboard threads, most recent
 * reply first. Only shown to Experienced editor, Administrator and Real user
 * (see `index.vue`). Three tabs: "All" threads; "Community", the discussions
 * admins pick for everyone (Community Configuration); and "Pinned", the
 * reader's own pins, from either. On the Home each tab shows three cards and
 * a "Show more"; as a `feed` (its own page) every thread, as divider rows.
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxTab, CdxTabs } from '@wikimedia/codex'

import HomeDiscussionCards from './HomeDiscussionCards.vue'
import HomeShowMore from './HomeShowMore.vue'
import { loadActiveDiscussions, loadCommunityPins } from './loadActiveDiscussions'
import type { DiscussionCard } from './loadActiveDiscussions'
import { useCommunityPinsConfig } from './useCommunityPinsConfig'
import { useModuleLoad } from './useModuleLoad'
import { usePinnedDiscussions } from './usePinnedDiscussions'

const props = defineProps<{
  /** The module's own page: every thread, as a feed. */
  feed?: boolean
}>()

/** Cards shown at first, and revealed by each "Show more". */
const PAGE_SIZE = 3

const {
  items: discussions,
  loading,
  error,
  reload,
} = useModuleLoad(
  () => 'all',
  (signal) => loadActiveDiscussions(signal),
)

const { pinnedCards, pinnedHrefs, togglePin } = usePinnedDiscussions()

const { pins: communityPins } = useCommunityPinsConfig()
const {
  items: communityCards,
  loading: communityLoading,
  error: communityError,
  reload: reloadCommunity,
} = useModuleLoad(
  () => JSON.stringify(communityPins.value),
  (signal) => loadCommunityPins(communityPins.value, signal),
)

type Tab = 'all' | 'community' | 'pinned'
const activeTab = ref<Tab>('all')

/** The live card when the thread is still in the All or Community list (newer counts). */
const live = (card: DiscussionCard): DiscussionCard =>
  discussions.value.find((other) => other.href === card.href) ??
  communityCards.value.find((other) => other.href === card.href) ??
  card

const pinned = computed(() => pinnedCards.value.map(live))

const tabCards = computed(() => {
  if (activeTab.value === 'community') return communityCards.value
  if (activeTab.value === 'pinned') return pinned.value
  return discussions.value
})

const tabLoading = computed(() => {
  if (activeTab.value === 'community') return communityLoading.value
  if (activeTab.value === 'pinned') return false
  return loading.value
})

const tabError = computed(() => {
  if (activeTab.value === 'community') return communityError.value
  if (activeTab.value === 'pinned') return false
  return error.value
})

function retry(): void {
  void (activeTab.value === 'community' ? reloadCommunity() : reload())
}

/** A tab's label, with its number of discussions when there are any: "Pinned (3)". */
const withCount = (label: string, count: number): string => (count ? `${label} (${count})` : label)

/** What an empty tab says. */
const EMPTY: Record<Tab, string> = {
  all: 'Nothing here right now.',
  community: 'No community discussions right now.',
  pinned: 'No pinned discussions. Pin a discussion to keep it here.',
}

const shown = ref(PAGE_SIZE)
watch(activeTab, () => (shown.value = PAGE_SIZE))

const visible = computed(() => (props.feed ? tabCards.value : tabCards.value.slice(0, shown.value)))
const hasMore = computed(() => shown.value < tabCards.value.length)
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
  <div ref="root" class="home-active-discussions">
    <CdxTabs v-model:active="activeTab" class="home-active-discussions__tabs">
      <CdxTab name="all" label="All" />
      <CdxTab name="community" :label="withCount('Community', communityPins.length)" />
      <CdxTab name="pinned" :label="withCount('Pinned', pinned.length)" />
    </CdxTabs>

    <div v-if="tabError" class="home-active-discussions__error">
      <p>Couldn't load this section.</p>
      <CdxButton weight="quiet" @click="retry">Try again</CdxButton>
    </div>

    <p v-else-if="!tabLoading && !tabCards.length" class="home-active-discussions__empty">
      {{ EMPTY[activeTab] }}
    </p>

    <template v-else>
      <HomeDiscussionCards
        :cards="visible"
        :loading="tabLoading"
        :skeletons="PAGE_SIZE"
        :feed="feed"
        :pinned-hrefs="pinnedHrefs"
        @toggle-pin="togglePin"
      />

      <HomeShowMore
        v-if="!feed"
        module="active-discussions"
        :has-more="hasMore"
        :expanded="expanded"
        :disabled="tabLoading"
        @more="shown += PAGE_SIZE"
        @collapse="collapse"
      />
    </template>
  </div>
</template>

<style scoped>
.home-active-discussions__tabs {
  margin-bottom: var(--spacing-75);
}

.home-active-discussions__error,
.home-active-discussions__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-50);
  margin: 0;
  color: var(--color-subtle);
}

.home-active-discussions__error p {
  margin: 0;
}
</style>
