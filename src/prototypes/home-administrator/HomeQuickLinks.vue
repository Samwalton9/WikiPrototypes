<script setup lang="ts">
/**
 * The Quick links module's body: the reader's own links to the pages and tools
 * they use most, in their order, each opening in a new tab. A wiki page has a
 * link icon; a web address an external-link icon. Only shown to Administrator
 * (see `index.vue`). With no links, it says what the module is for and offers
 * to add one. The list is edited in its dialog (`HomeQuickLinksDialog`).
 */
import { CdxButton, CdxIcon } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconLink, cdxIconLinkExternal } from '@wikimedia/codex-icons'

import { isWebAddress, quickLinkHref, quickLinkText, useQuickLinks } from './useQuickLinks'

const emit = defineEmits<{ edit: [] }>()

const { links } = useQuickLinks()
</script>

<template>
  <div class="home-quick-links">
    <div v-if="!links.length" class="home-quick-links__empty">
      <p>
        Keep links to the pages and tools you use most: noticeboards, backlogs, reports and tools.
      </p>
      <div>
        <CdxButton @click="emit('edit')">
          <CdxIcon :icon="cdxIconAdd" />
          Add a link
        </CdxButton>
      </div>
    </div>

    <ul v-else class="home-quick-links__list">
      <li v-for="link in links" :key="link.id" class="home-quick-links__item">
        <CdxIcon
          :icon="isWebAddress(link.target) ? cdxIconLinkExternal : cdxIconLink"
          size="small"
          class="home-quick-links__icon"
        />
        <a :href="quickLinkHref(link)" target="_blank" class="home-quick-links__link">
          {{ quickLinkText(link) }}
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* A Codex card's frame (`CdxCard`), as Your impact below. */
.home-quick-links {
  border: var(--border-width-base) var(--border-style-base) var(--border-color-base);
  border-radius: var(--border-radius-base);
  padding: var(--spacing-75);
  background-color: var(--background-color-base);
}

.home-quick-links__empty {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75);
}

.home-quick-links__empty p {
  margin: 0;
  color: var(--color-subtle);
}

.home-quick-links__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-50);
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-quick-links__item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-50);
}

/* One line box tall, so the icon centres on the link's first line. */
.home-quick-links__icon {
  flex-shrink: 0;
  height: 1lh;
  color: var(--color-subtle);
}

.home-quick-links__link {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
