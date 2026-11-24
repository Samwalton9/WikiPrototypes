<script setup lang="ts">
/**
 * The Backlogs feature's Community Configuration form: every backlog the
 * module can show, each with its category, its title in the module and the
 * count over which it's flagged Backlogged. Admins add as many as they like,
 * and remove any. Saving replaces the configuration (`useBacklogConfig`).
 */
import { computed, ref } from 'vue'
import { CdxButton, CdxField, CdxIcon, CdxTextInput } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconTrash } from '@wikimedia/codex-icons'

import CommunityConfigurationEditor from '@/components/community-configuration/CommunityConfigurationEditor.vue'
import type { CommunityConfigurationFeature } from '@/components/community-configuration/types'

import { DEFAULT_THRESHOLD } from './loadBacklogs'
import { categoryTitle, newBacklogId, useBacklogConfig } from './useBacklogConfig'

defineProps<{
  feature: CommunityConfigurationFeature
  basePath: string
}>()

/** One backlog as the form edits it: every field a string, as typed. */
interface Draft {
  id: string
  category: string
  label: string
  threshold: string
}

interface DraftErrors {
  category?: string
  label?: string
  threshold?: string
}

const { backlogs, save: saveConfig } = useBacklogConfig()

function toDraft(): Draft[] {
  return backlogs.value.map((backlog) => ({
    id: backlog.id,
    category: backlog.title.replace(/^Category:/, ''),
    label: backlog.label,
    threshold: String(backlog.threshold),
  }))
}

const drafts = ref<Draft[]>(toDraft())

function add(): void {
  drafts.value.push({
    id: newBacklogId(),
    category: '',
    label: '',
    threshold: String(DEFAULT_THRESHOLD),
  })
}

function remove(index: number): void {
  drafts.value.splice(index, 1)
}

const fieldErrors = computed<DraftErrors[]>(() => {
  const seen = new Map<string, number>()
  return drafts.value.map((draft, index) => {
    const errors: DraftErrors = {}
    const name = draft.category.trim()
    if (!name || /^category:\s*$/i.test(name)) {
      errors.category = 'Enter a category.'
    } else {
      const key = categoryTitle(name).toLowerCase()
      const first = seen.get(key)
      if (first != null) errors.category = `Backlog ${first + 1} already uses this category.`
      else seen.set(key, index)
    }
    if (!draft.label.trim()) errors.label = 'Enter a title.'
    if (!/^\d+$/.test(draft.threshold.trim())) errors.threshold = 'Enter a whole number, 0 or more.'
    return errors
  })
})

/** For the editor's error list: "Backlog 2 → Category: Enter a category." */
const errorList = computed(() =>
  fieldErrors.value.flatMap((errors, index) =>
    (
      [
        ['Category', errors.category],
        ['Title', errors.label],
        ['Backlogged over', errors.threshold],
      ] as const
    )
      .filter(([, message]) => message)
      .map(([field, message]) => `Backlog ${index + 1} → ${field}: ${message}`),
  ),
)

function save(): void {
  saveConfig(
    drafts.value.map((draft) => ({
      id: draft.id,
      label: draft.label.trim(),
      title: categoryTitle(draft.category),
      threshold: Number(draft.threshold.trim()),
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
  >
    <template #default="{ attempted }">
      <div class="backlogs-config">
        <h2 class="backlogs-config__heading">Backlogs</h2>
        <p class="backlogs-config__intro">
          The backlogs the Backlogs module can show, and how many pages it takes for each to be
          flagged as Backlogged.
        </p>

        <p v-if="!drafts.length" class="backlogs-config__empty">
          No backlogs. The Backlogs module has nothing to show.
        </p>

        <CdxField
          v-for="(draft, index) in drafts"
          :key="draft.id"
          is-fieldset
          class="backlogs-config__item"
        >
          <template #label>
            <span class="backlogs-config__item-label">
              Backlog {{ index + 1 }}
              <CdxButton
                weight="quiet"
                action="destructive"
                :aria-label="`Remove backlog ${index + 1}`"
                @click="remove(index)"
              >
                <CdxIcon :icon="cdxIconTrash" />
              </CdxButton>
            </span>
          </template>

          <CdxField
            :status="attempted && fieldErrors[index]?.category ? 'error' : 'default'"
            :messages="{ error: fieldErrors[index]?.category ?? '' }"
          >
            <template #label>Category</template>
            <template #description>The category the backlog's pages come from.</template>
            <CdxTextInput v-model="draft.category" placeholder="Candidates for speedy deletion" />
          </CdxField>

          <CdxField
            :status="attempted && fieldErrors[index]?.label ? 'error' : 'default'"
            :messages="{ error: fieldErrors[index]?.label ?? '' }"
          >
            <template #label>Title</template>
            <template #description>What the backlog is called in the Backlogs module.</template>
            <CdxTextInput v-model="draft.label" />
          </CdxField>

          <CdxField
            :status="attempted && fieldErrors[index]?.threshold ? 'error' : 'default'"
            :messages="{ error: fieldErrors[index]?.threshold ?? '' }"
          >
            <template #label>Backlogged over</template>
            <template #description>
              With more pages than this, the backlog is flagged as Backlogged.
            </template>
            <CdxTextInput v-model="draft.threshold" input-type="number" min="0" />
          </CdxField>
        </CdxField>

        <div>
          <CdxButton @click="add">
            <CdxIcon :icon="cdxIconAdd" />
            Add backlog
          </CdxButton>
        </div>
      </div>
    </template>
  </CommunityConfigurationEditor>
</template>

<style scoped>
.backlogs-config {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
}

/* Codex Heading 4. */
.backlogs-config__heading {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-size-large);
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-large);
  color: var(--color-base);
}

.backlogs-config__intro {
  margin: 0;
}

.backlogs-config__empty {
  margin: 0;
  color: var(--color-subtle);
}

/* Each backlog in its own outlined box, as the extension's array items. */
.backlogs-config__item {
  padding: var(--spacing-75) var(--spacing-100) var(--spacing-100);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}

/* CODEX+ CdxField: no actions slot beside a fieldset's legend; Remove sits at the legend's end. */
.backlogs-config__item :deep(legend) {
  width: 100%;
}

.backlogs-config__item-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-50);
}
</style>
