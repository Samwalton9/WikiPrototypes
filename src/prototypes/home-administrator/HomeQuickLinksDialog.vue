<script setup lang="ts">
/**
 * The Quick links module's "Edit quick links" dialog: the reader's links, each
 * with a handle to drag it into place (or move it with the arrow keys) and
 * buttons to edit and remove it, then "Add link". Every change saves at once,
 * so the dialog has no Save or Cancel of its own. Adding a link, or editing
 * one in its row, opens a form with its own submit and Cancel; one form at a
 * time.
 */
import { ref, watch } from 'vue'
import { CdxButton, CdxDialog, CdxIcon } from '@wikimedia/codex'
import { cdxIconAdd, cdxIconDraggable, cdxIconEdit, cdxIconTrash } from '@wikimedia/codex-icons'

import QuickLinkForm from './QuickLinkForm.vue'
import { useDragReorder } from './useDragReorder'
import { newQuickLinkId, quickLinkText, useQuickLinks } from './useQuickLinks'

const open = defineModel<boolean>('open', { default: false })

const { links, save } = useQuickLinks()

/** The open form: `'add'`, a link's id (editing it in its row), or `null`. */
const formFor = ref<string | null>(null)

watch(open, () => {
  formFor.value = null
})

function add(fields: { target: string; label: string }): void {
  save([...links.value, { id: newQuickLinkId(), ...fields }])
  formFor.value = null
}

function update(id: string, fields: { target: string; label: string }): void {
  save(links.value.map((link) => (link.id === id ? { ...link, ...fields } : link)))
  formFor.value = null
}

function remove(index: number): void {
  if (links.value[index]?.id === formFor.value) formFor.value = null
  save(links.value.filter((_, other) => other !== index))
}

function move(from: number, to: number): void {
  const next = [...links.value]
  const [link] = next.splice(from, 1)
  next.splice(to, 0, link)
  save(next)
}

const list = ref<HTMLOListElement | null>(null)
const { draggingId, handleListeners } = useDragReorder(list, () => links.value, move)
</script>

<template>
  <CdxDialog v-model:open="open" title="Edit quick links" use-close-button>
    <div class="quick-links-dialog">
      <p v-if="!links.length" class="quick-links-dialog__empty">No links yet.</p>

      <ol v-else ref="list" class="quick-links-dialog__list">
        <li
          v-for="(link, index) in links"
          :key="link.id"
          class="quick-links-dialog__item"
          :class="{ 'quick-links-dialog__item--dragging': draggingId === link.id }"
        >
          <QuickLinkForm
            v-if="formFor === link.id"
            class="quick-links-dialog__edit-form"
            legend="Edit link"
            submit-label="Save"
            :initial-target="link.target"
            :initial-label="link.label"
            @submit="update(link.id, $event)"
            @cancel="formFor = null"
          />
          <template v-else>
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
              @click="formFor = link.id"
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
          </template>
        </li>
      </ol>

      <QuickLinkForm
        v-if="formFor === 'add'"
        legend="Add a link"
        submit-label="Add"
        @submit="add"
        @cancel="formFor = null"
      />
      <div v-else>
        <CdxButton @click="formFor = 'add'">
          <CdxIcon :icon="cdxIconAdd" />
          Add link
        </CdxButton>
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

/* The row being edited holds the form, which fills it. */
.quick-links-dialog__edit-form {
  flex-grow: 1;
  margin-block: var(--spacing-25);
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
</style>
