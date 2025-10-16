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
import {
  getModerationAppModerationAppsAppIdGet,
  getModerationAppsModerationAppsGet,
} from "src/codegen"
import { ModerationRequestResponse } from "src/codegen/model"
import { Checkbox } from "@/components/ui/checkbox"
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
          credentials: "include",
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
    <div className="flex gap-3">
      {previousAppId && (
        <Link href={`/admin/moderation/${previousAppId}`}>Previous</Link>
      )}
      {nextAppId && <Link href={`/admin/moderation/${nextAppId}`}>Next</Link>}
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
          credentials: "include",
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
      <div className="flex flex-col">
        <h1 className="text-4xl font-extrabold">{appInfoQuery.data[0].name}</h1>
        <Link
          href={`/apps/${appInfoQuery.data[0].id}`}
          target="_blank"
          className="text-sm no-underline hover:underline"
        >
          {appInfoQuery.data[0].id}
        </Link>
        <a
          className="text-sm no-underline hover:underline"
          target="_blank"
          href={
            appInfoQuery.data[0].metadata?.["flathub::manifest"] ??
            `https://github.com/flathub/${appInfoQuery.data[0].id}`
          }
        >
          {t("manifest")}
        </a>
        <NavigatePreviousNext appId={appId} />
      </div>

      <div className="flex space-x-8">
        <div className="items-top flex space-x-1 pt-2">
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
          <div className="grid gap-1.5 leading-none">
            <label
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              htmlFor="include-outdated"
            >
              Include outdated requests
            </label>
          </div>
        </div>

        <div className="items-top flex space-x-1 pt-2">
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

      {query.data.data.requests.length === 0 && (
        <div>No reviews to show for this app.</div>
      )}

      <div className="flex flex-col space-y-4">
        {query.data.data.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} />
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
