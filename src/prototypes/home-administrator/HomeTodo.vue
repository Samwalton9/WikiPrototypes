<script setup lang="ts">
/**
 * The To-do module's body: the reader's own list of tasks, kept light. A box at
 * the top adds a task (Enter). Each open task has a handle to drag it into
 * place (or move it with the arrow keys), a checkbox, and buttons to edit (in
 * place) and remove it. A ticked task goes to "Completed", folded away under
 * the list, newest first; unticking it brings it back. `[[Page]]` in a task
 * links to the page. Only shown to Administrator (see `index.vue`).
 *
 * On the Home it shows the first five open tasks (and, unfolded, the five
 * latest completed ones), and always a way to the full list: on Vector a
 * dialog (`view-all`, which the Home opens), on Minerva the module's own page
 * (`[module]/index.vue`). As a `feed` (that page, or the dialog) it shows every
 * task.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { CdxButton, CdxCheckbox, CdxIcon, CdxTextInput } from '@wikimedia/codex'
import {
  cdxIconAdd,
  cdxIconCollapse,
  cdxIconDraggable,
  cdxIconEdit,
  cdxIconExpand,
  cdxIconTrash,
} from '@wikimedia/codex-icons'

import { preservedQueryFromLocationQuery } from '@/appearance/url-query'
import { useSkin } from '@/composables/useSkin'

import { HOME_PATH } from './homeRoutes'
import { useDragReorder } from './useDragReorder'
import { todoParts, useTodos, type Todo } from './useTodos'

const props = defineProps<{
  /** The module's own page: every task. */
  feed?: boolean
}>()

const emit = defineEmits<{ 'view-all': [] }>()

const skin = useSkin()

/** Tasks shown on the Home, in each section. */
const HOME_LIMIT = 5

const { open, completed, add, update, setDone, remove, clearCompleted, moveOpen } = useTodos()

const shownOpen = computed(() => (props.feed ? open.value : open.value.slice(0, HOME_LIMIT)))
const shownCompleted = computed(() =>
  props.feed ? completed.value : completed.value.slice(0, HOME_LIMIT),
)

const route = useRoute()
const fullListLocation = computed(() => ({
  path: `${HOME_PATH}/to-do`,
  query: preservedQueryFromLocationQuery(route.query),
}))

const newText = ref('')

function onAdd(): void {
  add(newText.value)
  newText.value = ''
}

const showCompleted = ref(false)

/* Edit in place: the task's text becomes a text box. Enter or leaving it saves; Escape doesn't. */
const editingId = ref<string | null>(null)
const editText = ref('')
const editInput = ref<InstanceType<typeof CdxTextInput>[] | null>(null)

async function startEdit(todo: Todo): Promise<void> {
  editingId.value = todo.id
  editText.value = todo.text
  await nextTick()
  editInput.value?.[0]?.focus()
}

function finishEdit(): void {
  if (editingId.value) update(editingId.value, editText.value)
  editingId.value = null
}

function cancelEdit(): void {
  editingId.value = null
}

const list = ref<HTMLOListElement | null>(null)
// The shown tasks are the first open ones, so their places are the open list's places.
const { draggingId, handleListeners } = useDragReorder(list, () => shownOpen.value, moveOpen)
</script>

<template>
  <div class="home-todo" :class="{ 'home-todo--feed': feed }">
    <CdxTextInput
      v-model="newText"
      :start-icon="cdxIconAdd"
      placeholder="Add a task"
      aria-label="Add a task"
      @keydown.enter.prevent="onAdd"
    />

    <p v-if="!open.length && !completed.length" class="home-todo__empty">
      Keep track of what you mean to do on the wiki. Type a task and press Enter. Write [[Page]] to
      link to a page.
    </p>
    <p v-else-if="!open.length" class="home-todo__empty">All done.</p>

    <ol v-if="open.length" ref="list" class="home-todo__list">
      <li
        v-for="(todo, index) in shownOpen"
        :key="todo.id"
        class="home-todo__item"
        :class="{ 'home-todo__item--dragging': draggingId === todo.id }"
      >
        <CdxButton
          weight="quiet"
          size="small"
          class="home-todo__handle"
          :aria-label="`Reorder “${todo.text}” (drag, or use the up and down arrow keys)`"
          v-on="handleListeners(todo.id, index)"
        >
          <CdxIcon :icon="cdxIconDraggable" size="small" />
        </CdxButton>

        <CdxTextInput
          v-if="editingId === todo.id"
          ref="editInput"
          v-model="editText"
          class="home-todo__edit"
          aria-label="Task"
          @keydown.enter.prevent="finishEdit"
          @keydown.esc.prevent="cancelEdit"
          @blur="finishEdit"
        />
        <CdxCheckbox
          v-else
          class="home-todo__check"
          :model-value="false"
          @update:model-value="setDone(todo.id, true)"
        >
          <template v-for="(part, partIndex) in todoParts(todo.text)" :key="partIndex">
            <a v-if="'href' in part" :href="part.href" target="_blank">{{ part.text }}</a>
            <template v-else>{{ part.text }}</template>
          </template>
        </CdxCheckbox>

        <span v-if="editingId !== todo.id" class="home-todo__actions">
          <CdxButton
            weight="quiet"
            size="small"
            :aria-label="`Edit “${todo.text}”`"
            @click="startEdit(todo)"
          >
            <CdxIcon :icon="cdxIconEdit" size="small" />
          </CdxButton>
          <CdxButton
            weight="quiet"
            size="small"
            action="destructive"
            :aria-label="`Remove “${todo.text}”`"
            @click="remove(todo.id)"
          >
            <CdxIcon :icon="cdxIconTrash" size="small" />
          </CdxButton>
        </span>
      </li>
    </ol>

    <div v-if="completed.length" class="home-todo__completed">
      <CdxButton
        weight="quiet"
        class="home-todo__completed-toggle"
        :aria-expanded="showCompleted"
        @click="showCompleted = !showCompleted"
      >
        <CdxIcon :icon="showCompleted ? cdxIconCollapse : cdxIconExpand" size="small" />
        Completed ({{ completed.length }})
      </CdxButton>

      <template v-if="showCompleted">
        <ul class="home-todo__list">
          <li v-for="todo in shownCompleted" :key="todo.id" class="home-todo__item">
            <CdxCheckbox
              class="home-todo__check home-todo__check--done"
              :model-value="true"
              @update:model-value="setDone(todo.id, false)"
            >
              <template v-for="(part, partIndex) in todoParts(todo.text)" :key="partIndex">
                <a v-if="'href' in part" :href="part.href" target="_blank">{{ part.text }}</a>
                <template v-else>{{ part.text }}</template>
              </template>
            </CdxCheckbox>
            <span class="home-todo__actions">
              <CdxButton
                weight="quiet"
                size="small"
                action="destructive"
                :aria-label="`Remove “${todo.text}”`"
                @click="remove(todo.id)"
              >
                <CdxIcon :icon="cdxIconTrash" size="small" />
              </CdxButton>
            </span>
          </li>
        </ul>
        <div>
          <CdxButton weight="quiet" size="small" @click="clearCompleted">
            Clear completed
          </CdxButton>
        </div>
      </template>
    </div>

    <!-- A link that looks like a button: it goes somewhere (Codex's CSS-only button). -->
    <RouterLink
      v-if="!feed && skin === 'mobile'"
      class="home-todo__view-all cdx-button cdx-button--fake-button cdx-button--fake-button--enabled"
      :to="fullListLocation"
    >
      View all tasks<template v-if="open.length > HOME_LIMIT"> ({{ open.length }})</template>
    </RouterLink>
    <CdxButton v-else-if="!feed" class="home-todo__view-all" @click="emit('view-all')">
      View all tasks<template v-if="open.length > HOME_LIMIT"> ({{ open.length }})</template>
    </CdxButton>
  </div>
</template>

<style scoped>
/* A Codex card's frame (`CdxCard`), as Quick links and Your impact. */
.home-todo {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-75);
  border: var(--border-width-base) var(--border-style-base) var(--border-color-base);
  border-radius: var(--border-radius-base);
  padding: var(--spacing-75);
  background-color: var(--background-color-base);
}

/* Its own page: the page is the frame. */
.home-todo--feed {
  border: 0;
  border-radius: 0;
  padding-inline: 0;
}

/* In the dialog, the dialog's own padding is the space around it. */
.cdx-dialog .home-todo--feed {
  padding: 0;
}

.home-todo__view-all {
  align-self: flex-start;
}

.home-todo__empty {
  margin: 0;
  color: var(--color-subtle);
}

.home-todo__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-todo__item {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-25);
  padding-block: var(--spacing-25);
  background-color: var(--background-color-base);
}

/* The row being dragged lifts off the list. */
.home-todo__item--dragging {
  position: relative;
  z-index: 1;
  border-radius: var(--border-radius-base);
  background-color: var(--background-color-interactive-subtle);
  box-shadow: var(--box-shadow-medium);
}

/* The handle takes the drag, not the page's scroll (touch), and shows it can. */
.home-todo__handle {
  flex-shrink: 0;
  cursor: grab;
  touch-action: none;
}

.home-todo__item--dragging .home-todo__handle {
  cursor: grabbing;
}

/* CODEX+ CdxCheckbox: a margin below each one, for a stack of them. Rows set their own spacing. */
.home-todo__check {
  flex-grow: 1;
  min-width: 0;
  margin-bottom: 0;
  overflow-wrap: anywhere;
}

.home-todo__edit {
  flex-grow: 1;
  min-width: 0;
}

/* Done: struck through, in the subtle colour. */
.home-todo__check--done :deep(.cdx-label__label__text) {
  color: var(--color-subtle);
  text-decoration: line-through;
}

.home-todo__actions {
  display: flex;
  flex-shrink: 0;
}

.home-todo__completed {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-25);
  border-top: var(--border-width-base) var(--border-style-base) var(--border-color-subtle);
  padding-top: var(--spacing-50);
}

.home-todo__completed-toggle {
  align-self: flex-start;
}
</style>
