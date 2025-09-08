import { useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import ApplicationCollection from "../application/Collection"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { setQueryParams } from "src/utils/queryParams"
import { getModerationAppsModerationAppsGet } from "src/codegen"
import { Checkbox } from "@/components/ui/checkbox"

const ModerationTabs: FunctionComponent = () => {
  const t = useTranslations()
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
        appstream: await getAppsInfo(
          apps.data.apps.map((app) => app.appid),
          "en",
        ),
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
      if (showHandledQuery)
        return `/admin/moderation/${appid}?includeHandled=true`

      return `/admin/moderation/${appid}`
    }

    return (
      <>
        <div className="flex space-x-8">
          <div className="items-top flex space-x-1 pt-2">
            <Checkbox
              id="filter-new"
              checked={filterNewSubmissionsQuery}
              onCheckedChange={(event) => {
                setQueryParams(router, {
                  filterNew: event ? "true" : undefined,
                  page: "1",
                })
              }}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="filter-new"
              >
                Only show new submissions
              </label>
            </div>
          </div>

          <div className="items-top flex space-x-1 pt-2">
            <Checkbox
              id="include-handled"
              checked={showHandledQuery}
              onCheckedChange={(event) => {
                setQueryParams(router, {
                  includeHandled: event ? "true" : undefined,
                  page: "1",
                })
              }}
            />
            <div className="grid gap-1.5 leading-none">
              <label
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                htmlFor="include-handled"
              >
                Include handled requests
              </label>
            </div>
          </div>
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
