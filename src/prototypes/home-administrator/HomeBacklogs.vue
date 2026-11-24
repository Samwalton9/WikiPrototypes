<script setup lang="ts">
/**
 * The Backlogs module's body: a card for each admin backlog category the
 * reader has turned on (`useBacklogSelection`, at most three), largest first, with how many pages wait in it. A count over the threshold is bold and
 * red, under a "Backlogged" chip. Each card opens the category's own page (`backlog/[category]/index.vue`),
 * a list of the pages in it.
 */
import { useRoute, useRouter } from 'vue-router'
import { CdxButton, CdxCard, CdxInfoChip } from '@wikimedia/codex'

import { preservedQueryFromLocationQuery } from '@/appearance/url-query'

import { HOME_PATH } from './homeRoutes'
import { loadBacklogCards, type BacklogCard } from './loadBacklogs'
import { useBacklogSelection } from './useBacklogSelection'
import { useModuleLoad } from './useModuleLoad'

const emit = defineEmits<{ choose: [] }>()

const route = useRoute()
const router = useRouter()

const { enabled } = useBacklogSelection()

const {
  items: cards,
  loading,
  error,
  reload,
} = useModuleLoad(
  // Reloads when the choice changes, or Community Configuration changes a chosen backlog.
  () => JSON.stringify(enabled.value),
  (signal) => loadBacklogCards(enabled.value, signal),
)

function location(card: BacklogCard) {
  return {
    path: `${HOME_PATH}/backlog/${card.id}`,
    query: preservedQueryFromLocationQuery(route.query),
  }
}

/** In-app navigation, unless the reader asked for a new tab or window. */
function open(event: MouseEvent, card: BacklogCard): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  void router.push(location(card))
}
</script>

<template>
  <div class="home-backlogs" :aria-busy="loading">
    <div v-if="error" class="home-backlogs__error">
      <p>Couldn't load this section.</p>
      <CdxButton weight="quiet" @click="reload">Try again</CdxButton>
    </div>

    <div v-else-if="!enabled.length" class="home-backlogs__error">
      <p>No backlogs chosen.</p>
      <CdxButton weight="quiet" @click="emit('choose')">Choose backlogs</CdxButton>
    </div>

    <template v-else-if="loading">
      <div
        v-for="category in enabled"
        :key="category.id"
        class="home-card-skeleton"
        aria-hidden="true"
      />
    </template>

    <CdxCard
      v-for="card in cards"
      v-else
      :key="card.id"
      :url="router.resolve(location(card)).href"
      @click="open($event, card)"
    >
      <template #title>
        <!-- CODEX+ CdxCard: no slot above the title, so the chip leads the title slot. -->
        <span v-if="card.backlogged" class="home-backlogs__chips">
          <CdxInfoChip status="error">Backlogged</CdxInfoChip>
        </span>
        {{ card.label }}
      </template>
      <template #description>
        <span
          class="home-backlogs__count"
          :class="{ 'home-backlogs__count--backlogged': card.backlogged }"
        >
          {{ card.count.toLocaleString() }}
        </span>
        {{ card.count === 1 ? 'page' : 'pages' }}
      </template>
    </CdxCard>
  </div>
</template>

<style scoped>
.home-backlogs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
}

.home-backlogs__error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-50);
  color: var(--color-subtle);
}

.home-backlogs__error p {
  margin: 0;
}

/* The chip sits on its own row above the title, in regular weight. */
.home-backlogs__chips {
  display: flex;
  margin-bottom: var(--spacing-50);
  font-weight: var(--font-weight-normal);
}

/* The count is the description's own text, in the card's text colour. */
.home-backlogs__count {
  color: var(--color-base);
}

.home-backlogs__count--backlogged {
  color: var(--color-error);
  font-weight: var(--font-weight-bold);
}

/*
 * CODEX+ No skeleton / loading-placeholder component in Codex.
 * The card's own outline, empty. The height matches a backlog card (title, count).
 */
.home-card-skeleton {
  box-sizing: border-box;
  height: 66px;
  border: var(--border-width-base) var(--border-style-base) var(--border-color-base);
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-base);
}
</style>
