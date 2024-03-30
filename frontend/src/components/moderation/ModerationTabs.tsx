import { useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { useUserContext } from "src/context/user-info"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import ApplicationCollection from "../application/Collection"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "next-i18next"
import { setQueryParams } from "src/utils/queryParams"
import { getModerationAppsModerationAppsGet } from "src/codegen"

const ModerationTabs: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()
  const router = useRouter()

  const PAGE_SIZE = 30
  const currentPage = parseInt((router.query.page as string) ?? "1")

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  const [filterNewSubmissionsQuery, setFilterNewSubmissionsQuery] =
    useState<boolean>(router.query.filterNew === "true")

  const [showHandledQuery, setShowHandledQuery] = useState<boolean>(
    router.query.includeHandled === "true",
  )

  useEffect(() => {
    setFilterNewSubmissionsQuery(router.query.filterNew === "true")
  }, [router.query.filterNew])

  useEffect(() => {
    setShowHandledQuery(router.query.includeHandled === "true")
  }, [router.query.includeHandled])

  useEffect(() => {
    setOffset((currentPage - 1) * PAGE_SIZE)
  }, [currentPage])

  const query = useQuery({
    queryKey: [
      "moderation",
      filterNewSubmissionsQuery,
      showHandledQuery,
      PAGE_SIZE,
      offset,
    ],
    queryFn: async ({ signal }) => {
      const apps = await getModerationAppsModerationAppsGet(
        {
          new_submissions:
            filterNewSubmissionsQuery === false ? undefined : true,
          show_handled: showHandledQuery === false ? undefined : true,
          limit: PAGE_SIZE,
          offset,
        },
        {
          withCredentials: true,
          signal,
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

  if (query.isPending) {
    return <Spinner size="m" />
  } else if (query.isError) {
    return <InlineError error={t(query.error.message)} shown={true} />
  } else {
    const link = (appid: string) => {
      if (showHandledQuery) return `/moderation/${appid}?includeHandled=true`

      return `/moderation/${appid}`
    }

    return (
      <>
        <div className="flex space-x-8">
          <span>
            <input
              id="filter-new"
              type="checkbox"
              checked={filterNewSubmissionsQuery}
              onChange={() => {
                setQueryParams(router, {
                  filterNew: filterNewSubmissionsQuery ? undefined : "true",
                  page: "1",
                })
              }}
            />
            <label htmlFor="filter-new" className="ms-2">
              Only show new submissions
            </label>
          </span>

          <span>
            <input
              id="include-handled"
              type="checkbox"
              checked={showHandledQuery}
              onChange={() => {
                setQueryParams(router, {
                  includeHandled: showHandledQuery ? undefined : "true",
                  page: "1",
                })
              }}
            />
            <label htmlFor="include-handled" className="ms-2">
              Include handled requests
            </label>
          </span>
        </div>
        <ApplicationCollection
          title={undefined}
          applications={query.data.appstream}
          totalHits={query.data.apps.apps_count}
          link={link}
        />

        <Pagination currentPage={currentPage} pages={pages} />
      </>
    )
  }
}

export default ModerationTabs
