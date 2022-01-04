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
}) => (
  <>
    <ApplicationSection
      key='editor_choice_apps'
      title="Editor's Choice Apps"
      applications={editorsChoiceApps}
      href='/apps/collection/editors-choice-apps'
    />
    <ApplicationSection
      key='editor_choice_games'
      title="Editor's Choice Games"
      applications={editorsChoiceGames}
      href='/apps/collection/editors-choice-games'
    />
    <ApplicationSection
      key='updated'
      title='New & Updated Apps'
      applications={recentlyUpdated}
      href='/apps/collection/recently-updated'
    />
    <ApplicationSection
      key='popular'
      title='Most Popular'
      applications={popular}
      href='/apps/collection/popular'
    />
  </>
)

export default ApplicationSections
