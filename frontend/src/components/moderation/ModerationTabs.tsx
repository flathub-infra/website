import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useCallback } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { getModerationApps } from "src/asyncs/moderation"
import { useUserContext } from "src/context/user-info"
import { useAsync } from "src/hooks/useAsync"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import ApplicationCollection from "../application/Collection"

const ModerationTabs: FunctionComponent = () => {
  const user = useUserContext()
  const router = useRouter()
  const { t } = useTranslation()

  const PAGE_SIZE = 30
  const currentPage = parseInt((router.query.page as string) ?? "1")

  const { status, value, error } = useAsync(
    useCallback(async () => {
      const apps = await getModerationApps(
        PAGE_SIZE,
        (currentPage - 1) * PAGE_SIZE,
      )
      return {
        apps,
        appstream: await getAppsInfo(apps.apps.map((app) => app.appid)),
      }
    }, [currentPage]),
    true,
  )

  const pages = Array.from(
    { length: Math.ceil((value?.apps.apps_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  if (status === "pending" || status === "idle") {
    return <Spinner size="m" />
  } else if (status === "error") {
    return <InlineError error={error} shown={true} />
  } else {
    const link = (appid: string) => `/moderation/${appid}`

    return (
      <div>
        <ApplicationCollection
          user={user}
          title="Pending Reviews"
          applications={value.appstream}
          totalHits={value.apps.apps_count}
          link={link}
        />

        <Pagination currentPage={currentPage} pages={pages} />
      </div>
    )
  }
}

export default ModerationTabs
