import { FunctionComponent, useCallback } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { getModerationApps } from "src/asyncs/moderation"
import { useAsync } from "src/hooks/useAsync"
import Tabs from "../Tabs"
import { useTranslation } from "next-i18next"
import ApplicationCollection from "../application/Collection"
import { useUserContext } from "src/context/user-info"
import Spinner from "../Spinner"
import InlineError from "../InlineError"

const ModerationTabs: FunctionComponent = () => {
  const user = useUserContext()
  const { t } = useTranslation()

  const { execute, status, value, error } = useAsync(
    useCallback(async () => {
      const apps = await getModerationApps()
      return {
        apps,
        appstream: await getAppsInfo(apps.apps.map((app) => app.appid)),
      }
    }, []),
    true,
  )

  if (status === "pending" || status === "idle") {
    return <Spinner size="m" />
  } else if (status === "error") {
    return <InlineError error={error} shown={true} />
  } else {
    const newSubmissionIds = {}
    for (const app of value.apps.apps) {
      if (app.is_new_submission) {
        newSubmissionIds[app.appid] = true
      }
    }

    const newSubmissions = value.appstream.filter(
      (app) => newSubmissionIds[app.id],
    )
    const updates = value.appstream.filter((app) => !newSubmissionIds[app.id])

    const link = (appid: string) => `/moderation/${appid}`

    const tabs = [
      {
        id: "updates",
        name: t("moderation-updates"),
        badge: updates.length,
        content: (
          <ApplicationCollection
            user={user}
            title={t("moderation-updates")}
            applications={updates}
            onRefresh={execute}
            link={link}
          />
        ),
      },
      {
        id: "new-submissions",
        name: t("moderation-new-submissions"),
        badge: newSubmissions.length,
        content: (
          <ApplicationCollection
            user={user}
            title={t("moderation-new-submissions")}
            applications={newSubmissions}
            onRefresh={execute}
            link={link}
          />
        ),
      },
    ]

    return <Tabs tabs={tabs} />
  }
}

export default ModerationTabs
