<script setup lang="ts">
/**
 * The Community discussions feature's Community Configuration form: the
 * discussions admins pick for the Community tab of every reader's Active
 * discussions, as on-wiki centralized discussions. Each is a page and,
 * optionally, a thread's heading on it. Admins add as many as they like, and
 * remove any. Saving replaces the configuration (`useCommunityPinsConfig`).
 */
import { computed, ref } from 'vue'
import { CdxButton, CdxField, CdxIcon, CdxTextInput } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconTrash } from '@wikimedia/codex-icons'

import CommunityConfigurationEditor from '@/components/community-configuration/CommunityConfigurationEditor.vue'
import type { CommunityConfigurationFeature } from '@/components/community-configuration/types'

import { newPinId, normalizeTitle, useCommunityPinsConfig } from './useCommunityPinsConfig'

defineProps<{
  feature: CommunityConfigurationFeature
  basePath: string
}>()

/** One discussion as the form edits it. */
interface Draft {
  id: string
  page: string
  section: string
}

const { pins, save: saveConfig, reset: resetConfig } = useCommunityPinsConfig()

function toDraft(): Draft[] {
  return pins.value.map((pin) => ({ ...pin }))
}

const drafts = ref<Draft[]>(toDraft())

function add(): void {
  drafts.value.push({ id: newPinId(), page: '', section: '' })
}

function remove(index: number): void {
  drafts.value.splice(index, 1)
}

/** Each discussion's page error: none, or one. */
const pageErrors = computed<(string | undefined)[]>(() => {
  const seen = new Map<string, number>()
  return drafts.value.map((draft, index) => {
    const page = normalizeTitle(draft.page)
    if (!page) return 'Enter a page.'
    const key = `${page}#${normalizeTitle(draft.section)}`.toLowerCase()
    const first = seen.get(key)
    if (first != null) return `Community discussion ${first + 1} is already this discussion.`
    seen.set(key, index)
    return undefined
  })
})

/** For the editor's error list: "Community discussion 2 → Page: Enter a page." */
const errorList = computed(() =>
  pageErrors.value.flatMap((error, index) =>
    error ? [`Community discussion ${index + 1} → Page: ${error}`] : [],
  ),
)

function reset(): void {
  resetConfig()
  drafts.value = toDraft()
}

function save(): void {
  saveConfig(
    drafts.value.map((draft) => ({
      id: draft.id,
      page: normalizeTitle(draft.page),
      section: normalizeTitle(draft.section),
    })),
  )
  drafts.value = toDraft()
}
</script>

<template>
  <CommunityConfigurationEditor
    :feature="feature"
    :base-path="basePath"
    :errors="errorList"
    @save="save"
    @reset="reset"
  >
    <template #default="{ attempted }">
      <div class="community-config">
        <h2 class="community-config__heading">Community discussions</h2>
        <p class="community-config__intro">
          Discussions to draw everyone's attention to. They show in the Community tab of every
          editor's Active discussions, where editors can pin them for themselves.
        </p>

        <p v-if="!drafts.length" class="community-config__empty">No community discussions.</p>

        <CdxField
          v-for="(draft, index) in drafts"
          :key="draft.id"
          is-fieldset
          class="community-config__item"
        >
          <template #label>
            <span class="community-config__item-label">
              Community discussion {{ index + 1 }}
              <CdxButton
                weight="quiet"
                action="destructive"
                :aria-label="`Remove community discussion ${index + 1}`"
                @click="remove(index)"
              >
                <CdxIcon :icon="cdxIconTrash" />
              </CdxButton>
            </span>
          </template>

          <CdxField
            :status="attempted && pageErrors[index] ? 'error' : 'default'"
            :messages="{ error: pageErrors[index] ?? '' }"
          >
            <template #label>Page</template>
            <template #description>The page the discussion is on.</template>
            <CdxTextInput v-model="draft.page" placeholder="Wikipedia:Village pump (policy)" />
          </CdxField>

          <CdxField optional>
            <template #label>Section</template>
            <template #description>
              The discussion's heading on that page. Leave it empty if the whole page is the
              discussion, such as a request for comment.
            </template>
            <CdxTextInput v-model="draft.section" />
          </CdxField>
        </CdxField>

        <div>
          <CdxButton @click="add">
            <CdxIcon :icon="cdxIconAdd" />
            Add community discussion
          </CdxButton>
        </div>
      </div>
    </template>
  </CommunityConfigurationEditor>
</template>

<style scoped>
.community-config {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
}

/* Codex Heading 4. */
.community-config__heading {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
  color: var(--color-base);
}

.community-config__intro {
  margin: 0;
}

.community-config__empty {
  margin: 0;
  color: var(--color-subtle);
}

/* Each discussion in its own outlined box, as the extension's array items. */
.community-config__item {
  padding: var(--spacing-75) var(--spacing-100) var(--spacing-100);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}

/* CODEX+ CdxField: no actions slot beside a fieldset's legend; Remove sits at the legend's end. */
.community-config__item :deep(legend) {
  width: 100%;
}

.community-config__item-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-50);
}
</style>
