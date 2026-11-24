<script setup lang="ts">
/**
 * The Backlogs module's "Choose backlogs" dialog: a checkbox for each backlog
 * Community Configuration offers, at most three on. Once three are on, the
 * rest are held until one goes off.
 * Save keeps the choice; Cancel (or closing) drops it.
 */
import { computed, ref, watch } from 'vue'
import { CdxCheckbox, CdxDialog, CdxField } from '@wikimedia/codex'

import { useBacklogConfig } from './useBacklogConfig'
import { MAX_BACKLOGS, useBacklogSelection } from './useBacklogSelection'

const open = defineModel<boolean>('open', { default: false })

const { backlogs } = useBacklogConfig()
const { enabledIds, setEnabled } = useBacklogSelection()

/** The choice being made: a copy, so Cancel leaves the module as it was. */
const draft = ref<string[]>([])

watch(
  open,
  (isOpen) => {
    if (isOpen) draft.value = [...enabledIds.value]
  },
  { immediate: true },
)

const full = computed(() => draft.value.length >= MAX_BACKLOGS)

function save(): void {
  setEnabled(draft.value)
  open.value = false
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    title="Choose backlogs"
    use-close-button
    :primary-action="{ label: 'Save', actionType: 'progressive' }"
    :default-action="{ label: 'Cancel' }"
    @primary="save"
    @default="open = false"
  >
    <CdxField is-fieldset>
      <template #label>Show up to {{ MAX_BACKLOGS }} backlogs in this module</template>
      <template #help-text>{{ draft.length }} of {{ MAX_BACKLOGS }} chosen</template>

      <CdxCheckbox
        v-for="category in backlogs"
        :key="category.id"
        v-model="draft"
        :input-value="category.id"
        :disabled="full && !draft.includes(category.id)"
      >
        {{ category.label }}
      </CdxCheckbox>
    </CdxField>
  </CdxDialog>
</template>
