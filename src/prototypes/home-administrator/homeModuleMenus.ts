/**
 * The modules' "…" menus (`HomeModuleMenu`), shared by the Home and the modules'
 * own pages. Most picks don't lead anywhere yet; Backlogs' "Choose backlogs"
 * opens its dialog and "Configure" its Community Configuration page (`index.vue`). Mentor's menu changes with its
 * state, so it lives with the module (`index.vue`).
 */
import {
  cdxIconConfigure,
  cdxIconEdit,
  cdxIconLevelOne,
  cdxIconReload,
  cdxIconSettings,
  cdxIconTrash,
} from '@wikimedia/codex-icons'

export const BACKLOGS_MENU = {
  items: [
    { value: 'choose', label: 'Choose backlogs', icon: cdxIconConfigure },
    { value: 'configure', label: 'Configure', icon: cdxIconSettings },
  ],
  footer: { value: 'about', label: 'About backlogs' },
}

export const SUGGESTED_EDITS_MENU = {
  items: [
    { value: 'interests', label: 'Interests', icon: cdxIconConfigure },
    { value: 'edit-types', label: 'Types of edits', icon: cdxIconLevelOne },
  ],
  footer: { value: 'about', label: 'About suggested edits' },
}

export const DAILY_READS_MENU = {
  items: [{ value: 'interests', label: 'Interests', icon: cdxIconConfigure }],
  footer: { value: 'about', label: 'About daily reads' },
}

/* "Configure" opens the Community discussions Community Configuration page (`index.vue`). */
export const ACTIVE_DISCUSSIONS_MENU = {
  items: [{ value: 'configure', label: 'Configure community discussions', icon: cdxIconSettings }],
  footer: { value: 'about', label: 'About active discussions' },
}

/* "Clear completed tasks" empties the To-do module's Completed section (`index.vue`). */
export const TODO_MENU = {
  items: [{ value: 'clear-completed', label: 'Clear completed tasks', icon: cdxIconTrash }],
  footer: { value: 'about', label: 'About to-do' },
}

/* "Edit quick links" opens the module's dialog (`index.vue`). */
export const QUICK_LINKS_MENU = {
  items: [{ value: 'edit', label: 'Edit quick links', icon: cdxIconEdit }],
  footer: { value: 'about', label: 'About quick links' },
}

export const REVIEW_CHANGES_MENU = {
  items: [{ value: 'personalization', label: 'Personalization', icon: cdxIconConfigure }],
  footer: { value: 'about', label: 'About review changes' },
}
