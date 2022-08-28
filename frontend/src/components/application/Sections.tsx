import { useTranslation } from "next-i18next"
import { FunctionComponent } from "react"
import { AppstreamListItem } from "src/types/Appstream"

import ApplicationSection from "./ApplicationSection"

interface Props {
  popular: AppstreamListItem[]
  recentlyUpdated: AppstreamListItem[]
  editorsChoiceApps: AppstreamListItem[]
  recentlyAdded: AppstreamListItem[]
}

const ApplicationSections: FunctionComponent<Props> = ({
  popular,
  recentlyUpdated,
  editorsChoiceApps,
  recentlyAdded,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <ApplicationSection
        key="editor_choice_apps"
        title={t("editors-choice-apps")}
        applications={editorsChoiceApps}
        href="/apps/collection/editors-choice-apps"
      />
      <ApplicationSection
        key="recently_added"
        title={t("recently-added-apps")}
        applications={recentlyAdded}
        href="/apps/collection/recently-added"
      />
      <ApplicationSection
        key="updated"
        title={t("new-and-updated-apps")}
        applications={recentlyUpdated}
        href="/apps/collection/recently-updated"
      />
      <ApplicationSection
        key="popular"
        title={t("popular-apps")}
        applications={popular}
        href="/apps/collection/popular"
      />
    </>
  )
}

export default ApplicationSections
