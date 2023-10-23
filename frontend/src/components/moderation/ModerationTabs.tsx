import { useRouter } from "next/router"
import { FunctionComponent, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { useUserContext } from "src/context/user-info"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import ApplicationCollection from "../application/Collection"
import { useQuery } from "@tanstack/react-query"
import { moderationApi } from "src/api"
import { useTranslation } from "next-i18next"

const ModerationTabs: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  const PAGE_SIZE = 30
  const currentPage = parseInt((router.query.page as string) ?? "1")

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  const query = useQuery({
    queryKey: ["moderation", currentPage],
    queryFn: async () => {
      const apps = await moderationApi.getModerationAppsModerationAppsGet(
        undefined,
        PAGE_SIZE,
        offset,
        {
          withCredentials: true,
        },
      )

      return {
        apps: apps.data,
        appstream: await getAppsInfo(apps.data.apps.map((app) => app.appid)),
      }
    },
  })

  const pages = Array.from(
    { length: Math.ceil((query.data?.apps.apps_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  if (query.isLoading) {
    return <Spinner size="m" />
  } else if (query.isError) {
    return <InlineError error={t(query.error as string)} shown={true} />
  } else {
    const link = (appid: string) => `/moderation/${appid}`

    return (
      <div>
        <ApplicationCollection
          user={user}
          title="Pending Reviews"
          applications={query.data.appstream}
          totalHits={query.data.apps.apps_count}
          link={link}
        />

        <Pagination currentPage={currentPage} pages={pages} />
      </div>
    )
  }
}

export default ModerationTabs
