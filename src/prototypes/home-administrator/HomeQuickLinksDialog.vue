<script setup lang="ts">
/**
 * The Quick links module's "Edit quick links" dialog: the reader's links, each
 * with a handle to drag it into place (or move it with the arrow keys) and
 * buttons to edit and remove it, then a form to add one (or edit the one
 * chosen)
 * (a page or a web address, and an optional label). Save keeps the changes,
 * with the link in the add form if there is one; Cancel (or closing) drops
 * them.
 */
import { computed, ref, watch } from 'vue'
import { CdxButton, CdxDialog, CdxField, CdxIcon, CdxTextInput } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconDraggable, cdxIconEdit, cdxIconTrash } from '@wikimedia/codex-icons'

import QuickLinkTargetLookup from './QuickLinkTargetLookup.vue'
import { useDragReorder } from './useDragReorder'
import {
  isWebAddress,
  newQuickLinkId,
  normalizeTarget,
  quickLinkText,
  useQuickLinks,
  type QuickLink,
} from './useQuickLinks'

const open = defineModel<boolean>('open', { default: false })

const { links, save: saveLinks } = useQuickLinks()

/** The links being edited: a copy, so Cancel leaves the module as it was. */
const draft = ref<QuickLink[]>([])

const newTarget = ref('')
const newLabel = ref('')
/** "Add" (or "Update") was tried: the target field shows its error from here on. */
const addAttempted = ref(false)
/** The link the form edits; `null`: the form adds a new one. */
const editingId = ref<string | null>(null)

function clearForm(): void {
  newTarget.value = ''
  newLabel.value = ''
  addAttempted.value = false
  editingId.value = null
}

const form = ref<InstanceType<typeof CdxField> | null>(null)

/** Load a link into the form, to edit it. */
function startEdit(link: QuickLink): void {
  editingId.value = link.id
  newTarget.value = link.target
  newLabel.value = link.label
  addAttempted.value = false
  ;(form.value?.$el as HTMLElement | undefined)?.scrollIntoView({
    block: 'nearest',
    behavior: 'smooth',
  })
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    draft.value = links.value.map((link) => ({ ...link }))
    clearForm()
  },
  { immediate: true },
)

const targetError = computed(() => {
  const target = newTarget.value.trim()
  if (!target) return 'Enter a page or a web address.'
  if (isWebAddress(target)) {
    try {
      new URL(target)
    } catch {
      return 'Enter a complete web address, such as https://example.org.'
    }
  }
  return ''
})

/**
 * Put the form's link in the list: a new one at the end, or the edited one in
 * its place. False if the form has an error.
 */
function submit(): boolean {
  addAttempted.value = true
  if (targetError.value) return false
  const fields = { target: normalizeTarget(newTarget.value), label: newLabel.value.trim() }
  const editing = draft.value.find((link) => link.id === editingId.value)
  if (editing) Object.assign(editing, fields)
  else draft.value.push({ id: newQuickLinkId(), ...fields })
  clearForm()
  return true
}

function move(from: number, to: number): void {
  const [link] = draft.value.splice(from, 1)
  draft.value.splice(to, 0, link)
}

const list = ref<HTMLOListElement | null>(null)
const { draggingId, handleListeners } = useDragReorder(list, () => draft.value, move)

function remove(index: number): void {
  const [link] = draft.value.splice(index, 1)
  if (link.id === editingId.value) clearForm()
}

/* A link typed (or edited) in the form but not yet added is saved too, so it isn't lost. */
function save(): void {
  const pending = editingId.value || newTarget.value.trim() || newLabel.value.trim()
  if (pending && !submit()) return
  saveLinks(draft.value)
  open.value = false
}
</script>

<template>
  <CdxDialog
    v-model:open="open"
    title="Edit quick links"
    use-close-button
    :primary-action="{ label: 'Save', actionType: 'progressive' }"
    :default-action="{ label: 'Cancel' }"
    @primary="save"
    @default="open = false"
  >
    <div class="quick-links-dialog">
      <p v-if="!draft.length" class="quick-links-dialog__empty">No links yet.</p>

      <ol v-else ref="list" class="quick-links-dialog__list">
        <li
          v-for="(link, index) in draft"
          :key="link.id"
          class="quick-links-dialog__item"
          :class="{
            'quick-links-dialog__item--dragging': draggingId === link.id,
            'quick-links-dialog__item--editing': editingId === link.id,
          }"
        >
          <CdxButton
            weight="quiet"
            class="quick-links-dialog__handle"
            :aria-label="`Reorder ${quickLinkText(link)} (drag, or use the up and down arrow keys)`"
            v-on="handleListeners(link.id, index)"
          >
            <CdxIcon :icon="cdxIconDraggable" />
          </CdxButton>
          <span class="quick-links-dialog__text">
            <span class="quick-links-dialog__label">{{ quickLinkText(link) }}</span>
            <span v-if="link.label" class="quick-links-dialog__target">{{ link.target }}</span>
          </span>
          <CdxButton
            weight="quiet"
            class="quick-links-dialog__row-action"
            :aria-label="`Edit ${quickLinkText(link)}`"
            :aria-pressed="editingId === link.id"
            @click="startEdit(link)"
          >
            <CdxIcon :icon="cdxIconEdit" />
          </CdxButton>
          <CdxButton
            weight="quiet"
            action="destructive"
            class="quick-links-dialog__row-action"
            :aria-label="`Remove ${quickLinkText(link)}`"
            @click="remove(index)"
          >
            <CdxIcon :icon="cdxIconTrash" />
          </CdxButton>
        </li>
      </ol>

      <CdxField ref="form" is-fieldset class="quick-links-dialog__add">
        <template #label>{{ editingId ? 'Edit link' : 'Add a link' }}</template>

        <CdxField
          :status="addAttempted && targetError ? 'error' : 'default'"
          :messages="{ error: targetError }"
        >
          <template #label>Page or web address</template>
          <template #description>
            A page on Wikipedia, or a shortcut to one such as WP:AIV, or a web address.
          </template>
          <QuickLinkTargetLookup v-model="newTarget" />
        </CdxField>

        <CdxField optional>
          <template #label>Label</template>
          <template #description>What the link says in the module.</template>
          <CdxTextInput v-model="newLabel" @keydown.enter.prevent="submit" />
        </CdxField>
      </CdxField>

      <div class="quick-links-dialog__form-actions">
        <CdxButton v-if="editingId" @click="submit">Update link</CdxButton>
        <CdxButton v-else @click="submit">
          <CdxIcon :icon="cdxIconAdd" />
          Add link
        </CdxButton>
        <CdxButton v-if="editingId" weight="quiet" @click="clearForm">Cancel</CdxButton>
      </div>
    </div>
  </CdxDialog>
</template>

<style scoped>
.quick-links-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-100);
}

.quick-links-dialog__empty {
  margin: 0;
  color: var(--color-subtle);
}

.quick-links-dialog__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.quick-links-dialog__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-50);
  padding-block: var(--spacing-25);
  background-color: var(--background-color-base);
}

/* The row being dragged lifts off the list. */
.quick-links-dialog__item--dragging {
  position: relative;
  z-index: 1;
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-interactive-subtle);
  box-shadow: var(--box-shadow-medium);
}

/* The handle takes the drag, not the page's scroll (touch), and shows it can. */
.quick-links-dialog__handle {
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}

.quick-links-dialog__item--dragging .quick-links-dialog__handle {
  cursor: grabbing;
}

.quick-links-dialog__item + .quick-links-dialog__item {
  border-top: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
}

.quick-links-dialog__text {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
  min-width: 0;
}

.quick-links-dialog__row-action {
  flex-shrink: 0;
}

/* The link in the form: marked in the list, so it's clear which one the form changes. */
.quick-links-dialog__item--editing {
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-progressive-subtle);
}

.quick-links-dialog__form-actions {
  display: flex;
  gap: var(--spacing-50);
}

.quick-links-dialog__label,
.quick-links-dialog__target {
  overflow-wrap: anywhere;
}

.quick-links-dialog__target {
  font-size: var(--font-size-small);
  line-height: var(--line-height-small);
  color: var(--color-subtle);
}

/* The add form's fields in their own outlined box; its "Add link" button follows it. */
.quick-links-dialog__add {
  padding: var(--spacing-75) var(--spacing-100) var(--spacing-100);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  border-radius: var(--border-radius-base);
}

/*
 * A fieldset's legend sits on its border. Floated, it is an ordinary first line
 * inside the box instead (the fields after it clear the float).
 */
.quick-links-dialog__add :deep(legend) {
  float: inline-start;
  width: 100%;
}

.quick-links-dialog__add :deep(legend + *) {
  clear: both;
}
</style>
