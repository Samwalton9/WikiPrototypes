<script setup lang="ts">
/**
 * A backlog category on its own page — `/home-administrator/backlog/<category>`,
 * where a Backlogs card leads. The bar (back to the Home, the category's name)
 * takes the wiki header's place, with no footer. Every page in the category
 * follows as divider rows, newest to join first; each opens on Wikipedia in a
 * new tab. An unknown category goes back to the Home.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CdxButton, CdxCard } from '@wikimedia/codex'

import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import SpecialPageWrapper from '@/components/SpecialPageWrapper.vue'
import { preservedQueryFromLocationQuery } from '@/appearance/url-query'

import HomeSubpageHeader from '../../HomeSubpageHeader.vue'
import { HOME_PATH } from '../../homeRoutes'
import { loadBacklogPages, type BacklogPage } from '../../loadBacklogs'
import { useBacklogConfig } from '../../useBacklogConfig'
import { useModuleLoad } from '../../useModuleLoad'

const route = useRoute()
const router = useRouter()

const categoryId = computed(() => {
  const param = (route.params as { category?: string | string[] }).category
  return String(Array.isArray(param) ? param[0] : (param ?? ''))
})

const { find } = useBacklogConfig()

const category = computed(() => find(categoryId.value))

watch(
  category,
  (found) => {
    if (!found) {
      void router.replace({ path: HOME_PATH, query: preservedQueryFromLocationQuery(route.query) })
    }
  },
  { immediate: true },
)

const {
  items: pages,
  loading,
  error,
  reload,
} = useModuleLoad<BacklogPage>(
  () => categoryId.value,
  (signal) => (category.value ? loadBacklogPages(category.value, signal) : Promise.resolve([])),
)

/** Skeleton rows while loading. */
const SKELETONS = 6

// PROTOWIKI+ Router: no `scrollBehavior`, so a new page keeps the old scroll position.
watch(categoryId, () => window.scrollTo(0, 0), { immediate: true })
</script>

<template>
  <ChromeWrapper :last-edited-notice="false" :show-footer="false">
    <template v-if="category" #header>
      <HomeSubpageHeader :title="category.label" />
    </template>

    <SpecialPageWrapper v-if="category" :title="null" class="home-backlog-page">
      <div v-if="error" class="home-backlog-page__message">
        <p>Couldn't load this category.</p>
        <CdxButton weight="quiet" @click="reload">Try again</CdxButton>
      </div>

      <p v-else-if="!loading && !pages.length" class="home-backlog-page__message">
        Nothing here right now.
      </p>

      <div v-else class="home-backlog-page__list" :aria-busy="loading">
        <template v-if="loading">
          <div
            v-for="index in SKELETONS"
            :key="index"
            class="home-card-skeleton"
            aria-hidden="true"
          />
        </template>

        <CdxCard
          v-for="page in pages"
          v-else
          :key="page.key"
          :url="page.href"
          target="_blank"
          separation="divider"
        >
          <template #title>
            {{ page.title }}
          </template>
          <template v-if="page.ago" #supporting-text>
            {{ page.ago }}
          </template>
        </CdxCard>
      </div>
    </SpecialPageWrapper>
  </ChromeWrapper>
</template>

<style scoped>
/*
 * PROTOWIKI+ SpecialPageWrapper: the list starts right under the bar — each
 * divider row brings its own 12px — with Minerva's 16px gutter.
 */
.home-backlog-page[data-skin] {
  padding-top: 0;
}

.home-backlog-page[data-skin='mobile'] {
  padding-inline: var(--spacing-100);
}

/* Vector: a full-width takeover with a slim inset, as the modules' own pages. */
.home-backlog-page[data-skin='desktop'] {
  max-width: none;
  padding-inline: var(--spacing-50);
}

.home-backlog-page__list {
  display: flex;
  flex-direction: column;
}

.home-backlog-page__message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-50);
  margin: 0;
  padding-top: var(--spacing-75);
  color: var(--color-subtle);
}

.home-backlog-page__message p {
  margin: 0;
}

/*
 * CODEX+ No skeleton / loading-placeholder component in Codex.
 * Divider rows, empty: no outline, a rule between. No fill and no motion.
 */
.home-card-skeleton {
  height: 66px;
  background-color: var(--background-color-base);
}

.home-card-skeleton + .home-card-skeleton {
  border-top: var(--border-width-base) var(--border-style-base) var(--border-color-base);
}
</style>
