<script setup lang="ts">
/** The Home's Community Configuration dashboard (`Special:CommunityConfiguration`). */
import ChromeWrapper from '@/components/chrome/ChromeWrapper.vue'
import CommunityConfigurationDashboard from '@/components/community-configuration/CommunityConfigurationDashboard.vue'

import { COMMUNITY_CONFIGURATION_PATH, FEATURES } from '../communityConfiguration'
</script>

<template>
  <ChromeWrapper :last-edited-notice="false">
    <CommunityConfigurationDashboard
      :features="FEATURES"
      :base-path="COMMUNITY_CONFIGURATION_PATH"
    />
  </ChromeWrapper>
</template>
