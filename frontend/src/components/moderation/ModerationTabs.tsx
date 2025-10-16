import { FunctionComponent, use, useEffect, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import ApplicationCollectionSuspense from "../application/ApplicationCollectionSuspense"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { getModerationAppsModerationAppsGet } from "src/codegen"
import { Checkbox } from "@/components/ui/checkbox"
import { usePathname, useRouter } from "src/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { setQueryParams } from "src/utils/queryParams"

const ModerationTabs: FunctionComponent = () => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const PAGE_SIZE = 30
  const currentPage = parseInt((searchParams.get("page") as string) ?? "1")

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  const [filterNewSubmissionsQuery, setFilterNewSubmissionsQuery] =
    useState<boolean>(searchParams.get("filterNew") === "true")

  const [showHandledQuery, setShowHandledQuery] = useState<boolean>(
    searchParams.get("includeHandled") === "true",
  )

  useEffect(() => {
    setFilterNewSubmissionsQuery(searchParams.get("filterNew") === "true")
  }, [searchParams.get("filterNew")])

  useEffect(() => {
    setShowHandledQuery(searchParams.get("includeHandled") === "true")
  }, [searchParams.get("includeHandled")])

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
          credentials: "include",
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
                setQueryParams(
                  router,
                  {
                    filterNew: event ? "true" : undefined,
                    page: "1",
                  },
                  pathname,
                  searchParams,
                )
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
                setQueryParams(
                  router,
                  {
                    includeHandled: event ? "true" : undefined,
                    page: "1",
                  },
                  pathname,
                  searchParams,
                )
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
        <ApplicationCollectionSuspense
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
