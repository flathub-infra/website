import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { setQueryParams } from "src/utils/queryParams"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import AppstreamChangesRow from "./AppstreamChangesRow"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import Breadcrumbs from "../Breadcrumbs"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import {
  getModerationAppModerationAppsAppIdGet,
  getModerationAppsModerationAppsGet,
} from "src/codegen"
import { ModerationRequestResponse } from "src/codegen/model"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Link, usePathname, useRouter } from "src/i18n/navigation"
import { useSearchParams } from "next/navigation"

interface Props {
  appId: string
}

const NavigatePreviousNext = ({ appId }) => {
  const [nextAppId, setNextAppId] = useState<string | undefined>()
  const [previousAppId, setPreviousAppId] = useState<string | undefined>()

  const listQuery = useQuery({
    queryKey: ["moderation", 9999],
    queryFn: async ({ signal }) => {
      const apps = await getModerationAppsModerationAppsGet(
        {
          limit: 9999,
        },
        {
          withCredentials: true,
          signal,
        },
      )

      return apps.data
    },
  })

  useEffect(() => {
    const currentIndex = listQuery.data?.apps?.findIndex(
      (a) => a.appid === appId,
    )
    if (currentIndex <= 0) {
      setPreviousAppId(undefined)
    } else {
      setPreviousAppId(listQuery.data?.apps[currentIndex - 1].appid)
    }

    if (currentIndex >= listQuery.data?.apps?.length - 1) {
      setNextAppId(undefined)
    } else {
      setNextAppId(listQuery.data?.apps[currentIndex + 1].appid)
    }
  }, [setNextAppId, setPreviousAppId, listQuery, appId])

  if (listQuery.isLoading || listQuery.data.apps.length === 0) {
    return null
  }

  return (
    <div className="flex gap-2">
      {previousAppId && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/moderation/${previousAppId}`}>
            <ChevronLeft className="me-2 h-4 w-4" />
            Previous
          </Link>
        </Button>
      )}
      {nextAppId && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/moderation/${nextAppId}`}>
            Next
            <ChevronRight className="ms-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}

const AppModeration: FunctionComponent<Props> = ({ appId }) => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [includeOutdatedQuery, setIncludeOutdatedQuery] = useState<boolean>(
    searchParams.get("includeOutdated") === "true",
  )

  const [includeHandledQuery, setIncludeHandledQuery] = useState<boolean>(
    searchParams.get("includeHandled") === "true",
  )

  const appInfoQuery = useQuery({
    queryKey: ["app", appId],
    queryFn: () => getAppsInfo([appId], "en"),
    enabled: !!appId,
  })

  const PAGE_SIZE = 10
  const currentPage = parseInt((searchParams.get("page") as string) ?? "1") ?? 1

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  useEffect(() => {
    setIncludeOutdatedQuery(searchParams.get("includeOutdated") === "true")
  }, [searchParams.get("includeOutdated")])

  useEffect(() => {
    setIncludeHandledQuery(searchParams.get("includeHandled") === "true")
  }, [searchParams.get("includeHandled")])

  useEffect(() => {
    setOffset((currentPage - 1) * PAGE_SIZE)
  }, [currentPage])

  const query = useQuery({
    queryKey: [
      "moderation",
      appId,
      includeOutdatedQuery,
      includeHandledQuery,
      PAGE_SIZE,
      offset,
    ],
    queryFn: ({ signal }) =>
      getModerationAppModerationAppsAppIdGet(
        appId,
        {
          include_outdated: includeOutdatedQuery,
          include_handled: includeHandledQuery,
          limit: PAGE_SIZE,
          offset,
        },
        {
          withCredentials: true,
          signal,
        },
      ),
    enabled: !!appId,
  })

  if (query.isPending || appInfoQuery.isPending) {
    return <Spinner size="m" />
  } else if (query.isError || appInfoQuery.isError) {
    return (
      <InlineError
        error={t(query.error.message ?? appInfoQuery.error.message)}
        shown={true}
      />
    )
  }

  const pages = Array.from(
    { length: Math.ceil((query.data.data.requests_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  return (
    <div className="space-y-8">
      <Breadcrumbs
        pages={[
          { name: "Moderation", href: "/admin/moderation", current: false },
          {
            name: appInfoQuery.data[0].name,
            href: `/admin/moderation/${appInfoQuery.data[0].id}`,
            current: true,
          },
        ]}
      />

      <div className="rounded-xl bg-flathub-white p-6 shadow-md dark:bg-flathub-arsenic">
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                {appInfoQuery.data[0].name}
              </h1>
            </div>
            <NavigatePreviousNext appId={appId} />
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link
              href={`/apps/${appInfoQuery.data[0].id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-flathub-celestial-blue hover:underline dark:text-flathub-celestial-blue"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {appInfoQuery.data[0].id}
            </Link>
            <a
              className="inline-flex items-center gap-1.5 text-flathub-celestial-blue hover:underline dark:text-flathub-celestial-blue"
              target="_blank"
              href={
                appInfoQuery.data[0].metadata?.["flathub::manifest"] ??
                `https://github.com/flathub/${appInfoQuery.data[0].id}`
              }
              rel="noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t("manifest")}
            </a>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 border-b border-flathub-gainsborow pb-4 dark:border-flathub-dark-gunmetal">
        <span className="text-sm font-medium text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          Filters:
        </span>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-outdated"
            checked={includeOutdatedQuery}
            onCheckedChange={(event) => {
              setQueryParams(
                router,
                {
                  includeOutdated: event ? "true" : undefined,
                  page: "1",
                },
                pathname,
                searchParams,
              )
            }}
          />
          <label
            className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="include-outdated"
          >
            Include outdated requests
          </label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="include-handled"
            checked={includeHandledQuery}
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
          <label
            className="cursor-pointer text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            htmlFor="include-handled"
          >
            Include handled requests
          </label>
        </div>
      </div>

      {query.data.data.requests.length === 0 && (
        <div className="rounded-xl bg-flathub-white p-6 text-center text-flathub-sonic-silver shadow-md dark:bg-flathub-arsenic dark:text-flathub-spanish-gray">
          No reviews to show for this app.
        </div>
      )}

      <div className="flex flex-col space-y-6">
        {query.data.data.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} useQueryParams />
    </div>
  )
}

export default AppModeration

export const getReviewRow = (request: ModerationRequestResponse) => {
  switch (request.request_type) {
    case "appdata":
      return <AppstreamChangesRow key={request.id} request={request} />
  }
}
