<script setup lang="ts">
/**
 * The Quick links dialog's form for one link: a page or a web address, and an
 * optional label, with its own submit and Cancel. The dialog shows it to add a
 * link, and in a link's row to edit that link. Enter in either field submits.
 */
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { CdxButton, CdxField, CdxTextInput } from '@wikimedia/codex'

import QuickLinkTargetLookup from './QuickLinkTargetLookup.vue'
import { isWebAddress, normalizeTarget } from './useQuickLinks'

const props = defineProps<{
  /** The fieldset's legend: "Add a link", "Edit link". */
  legend: string
  /** The submit button's label: "Add", "Save". */
  submitLabel: string
  /** The link's fields, when editing one. */
  initialTarget?: string
  initialLabel?: string
}>()

const emit = defineEmits<{
  submit: [fields: { target: string; label: string }]
  cancel: []
}>()

const target = ref(props.initialTarget ?? '')
const label = ref(props.initialLabel ?? '')
/** Submit was tried: the target field shows its error from here on. */
const attempted = ref(false)

const targetError = computed(() => {
  const trimmed = target.value.trim()
  if (!trimmed) return 'Enter a page or a web address.'
  if (isWebAddress(trimmed)) {
    try {
      new URL(trimmed)
    } catch {
      return 'Enter a complete web address, such as https://example.org.'
    }
  }
  return ''
})

function submit(): void {
  attempted.value = true
  if (targetError.value) return
  emit('submit', { target: normalizeTarget(target.value), label: label.value.trim() })
}

const root = useTemplateRef<HTMLFormElement>('root')

/* The form opens on a click, so the reader types into it at once. */
onMounted(() => {
  root.value?.querySelector('input')?.focus()
  root.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
})
</script>

<template>
  <!-- A form, so Enter in either field submits it. -->
  <form ref="root" class="quick-link-form" @submit.prevent="submit">
    <CdxField is-fieldset>
      <template #label>{{ legend }}</template>

      <CdxField
        :status="attempted && targetError ? 'error' : 'default'"
        :messages="{ error: targetError }"
      >
        <template #label>Page or web address</template>
        <template #description>
          A page on Wikipedia, or a shortcut to one such as WP:AIV, or a web address.
        </template>
        <QuickLinkTargetLookup v-model="target" />
      </CdxField>

      <CdxField optional>
        <template #label>Label</template>
        <template #description>What the link says in the module.</template>
        <CdxTextInput v-model="label" />
      </CdxField>
    </CdxField>

    <div class="quick-link-form__actions">
      <CdxButton type="button" @click="emit('cancel')">Cancel</CdxButton>
      <CdxButton type="submit" action="progressive" weight="primary">{{ submitLabel }}</CdxButton>
    </div>
  </form>
</template>

<style scoped>
/* The fields in their own outlined box, its buttons at the foot of it. */
.quick-link-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75);
  padding: var(--spacing-75) var(--spacing-100) var(--spacing-100);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-base);
}

/*
 * A fieldset's legend sits on its border. Floated, it is an ordinary first line
 * inside the box instead (the fields after it clear the float).
 */
.quick-link-form :deep(legend) {
  float: inline-start;
  width: 100%;
}

.quick-link-form :deep(legend + *) {
  clear: both;
}

.quick-link-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-50);
}
</style>
