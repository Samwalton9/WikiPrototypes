<script setup lang="ts">
/**
 * A module's list of discussion cards: Codex `CdxCard`s with no thumbnail — the
 * thread, its noticeboard, then its comments and when — opening the thread on
 * Wikipedia in a new tab. Each card has a pin button in its top corner. While
 * loading it shows flat skeletons of the same shape. As a `feed` (a module's
 * own page) the cards are divider rows.
 */
import { CdxButton, CdxCard, CdxIcon } from '@wikimedia/codex'
import { cdxIconPushPin, cdxIconSpeechBubbles } from '@wikimedia/codex-icons'

import type { DiscussionCard } from './loadActiveDiscussions'

const emit = defineEmits<{ 'toggle-pin': [card: DiscussionCard] }>()

defineProps<{
  cards: readonly DiscussionCard[]
  loading?: boolean
  /** Skeletons shown while loading. */
  skeletons: number
  /** Divider rows rather than outlined cards (a module's own page). */
  feed?: boolean
  /** The links of the pinned threads. */
  pinnedHrefs: ReadonlySet<string>
}>()
</script>

<template>
  <div class="home-discussion-cards" :class="{ 'home-feed': feed }" :aria-busy="loading">
    <template v-if="loading">
      <div v-for="index in skeletons" :key="index" class="home-card-skeleton" aria-hidden="true" />
    </template>

    <div v-for="card in cards" v-else :key="card.href" class="home-discussion-cards__item">
      <CdxCard
        class="home-discussion-cards__card"
        :url="card.href"
        target="_blank"
        :separation="feed ? 'divider' : undefined"
      >
        <template #title>{{ card.title }}</template>
        <template v-if="card.board" #description>{{ card.board }}</template>
        <template v-if="card.comments" #supporting-text>
          <span class="home-discussion-cards__supporting">
            <span class="home-discussion-cards__supporting-icon">
              <CdxIcon :icon="cdxIconSpeechBubbles" size="small" />
            </span>
            <span>{{ card.comments }}</span>
            <span class="home-discussion-cards__time">{{ card.ago }}</span>
          </span>
        </template>
      </CdxCard>
      <!-- Beside the card, not in it: the card is a link, and a button can't be in a link. -->
      <CdxButton
        class="home-discussion-cards__pin"
        weight="quiet"
        :action="pinnedHrefs.has(card.href) ? 'progressive' : 'default'"
        :aria-label="pinnedHrefs.has(card.href) ? 'Unpin discussion' : 'Pin discussion'"
        :aria-pressed="pinnedHrefs.has(card.href)"
        @click="emit('toggle-pin', card)"
      >
        <CdxIcon :icon="cdxIconPushPin" />
      </CdxButton>
    </div>
  </div>
</template>

<style scoped>
.home-discussion-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
}

/* PROTOWIKI+ The pin button sits over the card's top end corner. */
.home-discussion-cards__item {
  position: relative;
}

.home-discussion-cards__pin {
  position: absolute;
  top: var(--spacing-50);
  inset-inline-end: var(--spacing-50);
}

/* A divider row has no side padding, so the button goes to the row's edge. */
.home-feed .home-discussion-cards__pin {
  inset-inline-end: 0;
}

/* The title wraps before it reaches the pin button. */
.home-discussion-cards__card :deep(.cdx-card__text__title) {
  padding-inline-end: var(--min-size-interactive-pointer);
}

/*
 * CODEX+ CdxCard: the divider between rows is for adjacent cards. Each card here
 * is in its own wrapper (with its pin button), so the wrappers draw it.
 */
.home-feed .home-discussion-cards__item + .home-discussion-cards__item .cdx-card {
  border-top: var(--border-width-base) var(--border-style-base) var(--border-color-base);
}

/*
 * CODEX+ CdxCard: no slot for a timestamp. The supporting line runs the full
 * width with the time at its far end, so it lands in the bottom corner.
 */
.home-discussion-cards__card :deep(.cdx-card__text) {
  flex-grow: 1;
}

.home-discussion-cards__supporting {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-25);
}

/* One line box tall, so the icon centres on the first line of text. */
.home-discussion-cards__supporting-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  height: 1lh;
}

/* On the label's last line when the label wraps (the icon stays with its first). */
.home-discussion-cards__time {
  flex-shrink: 0;
  align-self: flex-end;
  margin-inline-start: auto;
  padding-inline-start: var(--spacing-50);
  white-space: nowrap;
}

/*
 * CODEX+ No skeleton / loading-placeholder component in Codex.
 * The card's own outline, empty. No fill and no motion. The height matches a
 * typical discussion card (title, noticeboard, comments).
 */
.home-card-skeleton {
  box-sizing: border-box;
  height: 107px;
  border: var(--border-width-base) var(--border-style-base) var(--border-color-base);
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-base);
}

/* A feed: divider rows, so no gap between them, and skeletons are rows too (no outline, a rule between). */
.home-feed {
  gap: 0;
}

.home-feed .home-card-skeleton {
  border-width: 0;
  border-radius: 0;
}

.home-feed .home-card-skeleton + .home-card-skeleton {
  border-top-width: var(--border-width-base);
}
</style>
