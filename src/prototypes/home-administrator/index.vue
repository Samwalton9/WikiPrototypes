<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CdxDialog } from '@wikimedia/codex'
import { cdxIconHome } from '@wikimedia/codex-icons'

import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import SpecialPageWrapper from '@/components/SpecialPageWrapper.vue'
import { preservedQueryFromLocationQuery } from '@/appearance/url-query'
import { useConfig } from '@/composables/useConfig'
import { globalSkin } from '@/theme'
import HomeActiveDiscussions from './HomeActiveDiscussions.vue'
import HomeBacklogs from './HomeBacklogs.vue'
import HomeBacklogsDialog from './HomeBacklogsDialog.vue'
import HomeDailyReads from './HomeDailyReads.vue'
import HomeImpact from './HomeImpact.vue'
import HomeMentor from './HomeMentor.vue'
import HomeModuleMenu from './HomeModuleMenu.vue'
import HomePageHeader from './HomePageHeader.vue'
import HomeQuickLinks from './HomeQuickLinks.vue'
import HomeQuickLinksDialog from './HomeQuickLinksDialog.vue'
import HomeReviewChanges from './HomeReviewChanges.vue'
import HomeSectionFrame from './HomeSectionFrame.vue'
import HomeSuggestedEdits from './HomeSuggestedEdits.vue'
import HomeTodo from './HomeTodo.vue'
import {
  ACTIVE_DISCUSSIONS_MENU,
  BACKLOGS_MENU,
  DAILY_READS_MENU,
  QUICK_LINKS_MENU,
  REVIEW_CHANGES_MENU,
  SUGGESTED_EDITS_MENU,
  TODO_MENU,
} from './homeModuleMenus'
import { COMMUNITY_CONFIGURATION_PATH } from './communityConfiguration'
import { HOME_PATH } from './homeRoutes'
import { MENTOR_CONTENT } from './mentorContent'
import { useHomeMentor } from './useHomeMentor'
import { useTodos } from './useTodos'

definePage({
  meta: {
    title: 'Administrator Home',
    description: 'Home modules for admins',
    platform: 'web',
    icon: cdxIconHome,
  },
})

const { pageTitle, user } = useConfig()

/*
 * Default to Administrator when the reader arrives from outside this prototype.
 * Moves between its own pages keep the preset that the reader chose.
 */
const previousPath: unknown = window.history.state?.back
if (typeof previousPath !== 'string' || !previousPath.startsWith(HOME_PATH)) {
  user.value = 'admin'
}

/* Desktop: 60/40, main column then side column. Mobile: one column. */
const isSplit = computed(() => globalSkin.value === 'desktop')

/*
 * Administrator: the admin's Home — Review changes, Active discussions, Quick
 * links, To-do, Your impact and Backlogs only.
 */
const isAdmin = computed(() => user.value === 'admin')

/* Review changes and Active discussions are for experienced editors: Experienced editor and Real user. */
const showEditorModules = computed(() => user.value === 'experienced' || user.value === 'real')

const {
  isAssigned: isMentorAssigned,
  assign: assignMentor,
  optOut: optOutOfMentor,
} = useHomeMentor()
const mentorTitle = computed(() =>
  isMentorAssigned.value ? MENTOR_CONTENT.assigned.title : MENTOR_CONTENT.unassigned.title,
)
/* With a mentor: opt out. Without one: get one, as the module's own button does. */
const mentorMenu = computed(() => ({
  items: isMentorAssigned.value
    ? [{ value: 'opt-out', label: 'Opt out of mentorship' }]
    : [{ value: 'get-mentor', label: MENTOR_CONTENT.unassigned.action }],
  footer: { value: 'about', label: 'About mentors' },
}))

const route = useRoute()
const router = useRouter()

const { clearCompleted } = useTodos()

/* Vector: To-do's "View all tasks" opens the full list in a dialog. */
const viewingAllTodos = ref(false)

function onTodoMenuSelect(value: string | number): void {
  if (value === 'clear-completed') clearCompleted()
}

/* Quick links' "Edit quick links" dialog. */
const editingQuickLinks = ref(false)

function onQuickLinksMenuSelect(value: string | number): void {
  if (value === 'edit') editingQuickLinks.value = true
}

/* Backlogs' "Choose backlogs" dialog. */
const choosingBacklogs = ref(false)

/* Open a feature's Community Configuration form. */
function configure(featureId: string): void {
  void router.push({
    path: `${COMMUNITY_CONFIGURATION_PATH}/${featureId}`,
    query: preservedQueryFromLocationQuery(route.query),
  })
}

/* "Configure" leads to the module's Community Configuration form. */
function onBacklogsMenuSelect(value: string | number): void {
  if (value === 'choose') choosingBacklogs.value = true
  if (value === 'configure') configure('GrowthBacklogs')
}

function onActiveDiscussionsMenuSelect(value: string | number): void {
  if (value === 'configure') configure('CommunityDiscussions')
}

function onMentorMenuSelect(value: string | number): void {
  if (value === 'opt-out') optOutOfMentor()
  if (value === 'get-mentor') assignMentor()
}
</script>

<template>
  <ChromeWrapper :last-edited-notice="false">
    <!-- The Home draws its own header: the greeting over production's page tabs. -->
    <SpecialPageWrapper :title="null" class="home-page">
      <HomePageHeader :title="pageTitle" />

      <div class="home-columns" :class="{ 'home-columns--split': isSplit }">
        <div class="home-modules home-modules--main">
          <HomeSectionFrame v-if="!isAdmin" id="suggested-edits" title="Suggested edits">
            <template #actions>
              <HomeModuleMenu :menu="SUGGESTED_EDITS_MENU" />
            </template>
            <HomeSuggestedEdits />
          </HomeSectionFrame>

          <HomeSectionFrame v-if="!isAdmin" id="daily-reads" title="Daily reads">
            <template #actions>
              <HomeModuleMenu :menu="DAILY_READS_MENU" />
            </template>
            <HomeDailyReads />
          </HomeSectionFrame>

          <HomeSectionFrame
            v-if="isAdmin || showEditorModules"
            id="review-changes"
            title="Review changes"
          >
            <template #actions>
              <HomeModuleMenu :menu="REVIEW_CHANGES_MENU" />
            </template>
            <HomeReviewChanges />
          </HomeSectionFrame>

          <HomeSectionFrame
            v-if="isAdmin || showEditorModules"
            id="active-discussions"
            title="Active discussions"
          >
            <template #actions>
              <HomeModuleMenu
                :menu="ACTIVE_DISCUSSIONS_MENU"
                @select="onActiveDiscussionsMenuSelect"
              />
            </template>
            <HomeActiveDiscussions />
          </HomeSectionFrame>
        </div>

        <div class="home-modules home-modules--side">
          <HomeSectionFrame v-if="isAdmin" id="quick-links" title="Quick links">
            <template #actions>
              <HomeModuleMenu :menu="QUICK_LINKS_MENU" @select="onQuickLinksMenuSelect" />
            </template>
            <HomeQuickLinks @edit="editingQuickLinks = true" />
            <HomeQuickLinksDialog v-model:open="editingQuickLinks" />
          </HomeSectionFrame>

          <HomeSectionFrame v-if="isAdmin" id="to-do" title="To-do">
            <template #actions>
              <HomeModuleMenu :menu="TODO_MENU" @select="onTodoMenuSelect" />
            </template>
            <HomeTodo @view-all="viewingAllTodos = true" />
            <CdxDialog v-model:open="viewingAllTodos" title="To-do" use-close-button>
              <HomeTodo feed />
            </CdxDialog>
          </HomeSectionFrame>

          <HomeSectionFrame id="impact" title="Your impact">
            <HomeImpact />
          </HomeSectionFrame>

          <HomeSectionFrame v-if="isAdmin" id="backlogs" title="Backlogs">
            <template #actions>
              <HomeModuleMenu :menu="BACKLOGS_MENU" @select="onBacklogsMenuSelect" />
            </template>
            <HomeBacklogs @choose="choosingBacklogs = true" />
            <HomeBacklogsDialog v-model:open="choosingBacklogs" />
          </HomeSectionFrame>

          <HomeSectionFrame v-if="!isAdmin" id="mentor" :title="mentorTitle">
            <template #actions>
              <HomeModuleMenu :menu="mentorMenu" @select="onMentorMenuSelect" />
            </template>
            <HomeMentor />
          </HomeSectionFrame>
        </div>
      </div>
    </SpecialPageWrapper>
  </ChromeWrapper>
</template>

<style scoped>
.home-page {
  padding-bottom: var(--spacing-300);
}

/* PROTOWIKI+ SpecialPageWrapper: mobile gutter is the desktop one. */
.home-page[data-skin='mobile'] {
  padding-inline: var(--spacing-100);
}

/*
 * PROTOWIKI+ SpecialPageWrapper: no content-width option (it clamps at ~1596px).
 * Vector: the column `Special:CreateAccount` uses — 984px of content inside the
 * wrapper's own padding — rather than the special page's ~1596px clamp.
 */
.home-page[data-skin='desktop'] {
  max-width: calc(984px + 2 * var(--spacing-150));
}

.home-modules {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-200);
}

/* Each desktop module is a block of cards, so it needs a wider break between. */
.home-page[data-skin='desktop'] .home-modules {
  gap: var(--spacing-300);
  margin-top: var(--spacing-100);
}

/* Mobile: one column, the main column's modules first, with the modules' own gap between. */
.home-columns {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-200);
}

/* Desktop: 60/40, each column's modules from the top. */
.home-columns--split {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  align-items: start;
  column-gap: var(--spacing-200);
}

/*
 * Narrow desktop: one column. With the side column's own top margin, the row
 * gap makes the desktop modules' 48px break between the columns' modules.
 */
@media (max-width: 767px) {
  .home-columns--split {
    grid-template-columns: minmax(0, 1fr);
    row-gap: var(--spacing-200);
  }
}
</style>
