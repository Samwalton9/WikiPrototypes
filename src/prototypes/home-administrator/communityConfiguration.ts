/**
 * The Home's Community Configuration: the features its admins configure, at
 * `/home-administrator/community-configuration`.
 */
import type { CommunityConfigurationFeature } from '@/components/community-configuration/types'

import { HOME_PATH } from './homeRoutes'

export const COMMUNITY_CONFIGURATION_PATH = `${HOME_PATH}/community-configuration`

export const FEATURES: readonly CommunityConfigurationFeature[] = [
  {
    id: 'GrowthBacklogs',
    title: 'Backlogs',
    description: "Customize the newcomer homepage's Backlogs module.",
  },
]
