import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'

import { Appstream } from '../../types/Appstream'
import ApplicationSection from './ApplicationSection'

interface Props {
  popular: Appstream[]
  recentlyUpdated: Appstream[]
  editorsChoiceApps: Appstream[]
  editorsChoiceGames: Appstream[]
}

const ApplicationSections: FunctionComponent<Props> = ({
  popular,
  recentlyUpdated,
  editorsChoiceApps,
  editorsChoiceGames,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <ApplicationSection
        key='editor_choice_apps'
        title={t("editors-choice-apps")}
        applications={editorsChoiceApps}
        href='/apps/collection/editors-choice-apps'
      />
      <ApplicationSection
        key='editor_choice_games'
        title={t("editors-choice-games")}
        applications={editorsChoiceGames}
        href='/apps/collection/editors-choice-games'
      />
      <ApplicationSection
        key='updated'
        title={t("new-and-updated-apps")}
        applications={recentlyUpdated}
        href='/apps/collection/recently-updated'
      />
      <ApplicationSection
        key='popular'
        title={t("popular-apps")}
        applications={popular}
        href='/apps/collection/popular'
      />
    </>
  )
}

export default ApplicationSections
