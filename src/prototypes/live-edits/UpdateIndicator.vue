<script setup lang="ts">
/** Tells the reader that the article has a new edit; a click refreshes it. */
import { cdxIconReload } from '@wikimedia/codex-icons'
import { CdxButton, CdxIcon } from '@wikimedia/codex'

defineEmits<{
  refresh: []
}>()
</script>

<template>
  <CdxButton
    class="update-indicator"
    size="small"
    action="progressive"
    title="This article has changed since you opened it. Refresh to see the new version."
    @click="$emit('refresh')"
  >
    <CdxIcon :icon="cdxIconReload" />
    1 new edit
  </CdxButton>
</template>

<style scoped>
/* A pill, as an indicator beside the title rather than a page action. */
.update-indicator {
  border-radius: var(--border-radius-pill, 9999px);
  font-family: var(--font-family-system-sans, system-ui, sans-serif);
}
</style>
