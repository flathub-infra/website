import { useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { setQueryParams } from "src/utils/queryParams"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import AppstreamChangesRow from "./AppstreamChangesRow"
import Link from "next/link"
import { ModerationRequestResponse } from "src/codegen"
import { useQuery } from "@tanstack/react-query"
import { moderationApi } from "src/api"
import { useTranslation } from "next-i18next"

interface Props {
  appId: string
}

const AppModeration: FunctionComponent<Props> = ({ appId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  const [includeOutdatedQuery, setIncludeOutdatedQuery] = useState<boolean>(
    router.query.includeOutdated === "true",
  )

  const [includeHandledQuery, setIncludeHandledQuery] = useState<boolean>(
    router.query.includeHandled === "true",
  )

  const appInfoQuery = useQuery({
    queryKey: ["app", appId],
    queryFn: () => getAppsInfo([appId]),
    enabled: !!appId,
  })

  const PAGE_SIZE = 10
  const currentPage = parseInt((router.query.page as string) ?? "1") ?? 1

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  useEffect(() => {
    setOffset((currentPage - 1) * PAGE_SIZE)
  }, [currentPage])

  const query = useQuery({
    queryKey: [
      "moderation",
      appId,
      includeOutdatedQuery,
      includeHandledQuery,
      offset,
    ],
    queryFn: () =>
      moderationApi.getModerationAppModerationAppsAppIdGet(
        appId,
        includeOutdatedQuery,
        includeHandledQuery,
        PAGE_SIZE,
        offset,
        {
          withCredentials: true,
        },
      ),
    enabled: !!appId,
  })

  if (query.isLoading || appInfoQuery.isLoading) {
    return <Spinner size="m" />
  } else if (query.isError || appInfoQuery.isError) {
    return (
      <InlineError
        error={t((query.error as string) ?? (appInfoQuery.error as string))}
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
      <div>
        <h1 className="mt-8 text-4xl font-extrabold">
          {appInfoQuery.data[0].name}
        </h1>
        <Link
          href={`/apps/${appInfoQuery.data[0].id}`}
          className="text-sm opacity-75"
        >
          {appInfoQuery.data[0].id}
        </Link>
      </div>

      <div className="flex space-x-8">
        <span>
          <input
            id="include-outdated"
            type="checkbox"
            checked={includeOutdatedQuery}
            onChange={() => {
              setQueryParams(router, {
                includeOutdated: includeOutdatedQuery ? undefined : "true",
                page: "1",
              })
            }}
          />
          <label htmlFor="include-outdated" className="ms-2">
            Include outdated requests
          </label>
        </span>

        <span>
          <input
            id="include-handled"
            type="checkbox"
            checked={includeHandledQuery}
            onChange={() => {
              setQueryParams(router, {
                includeHandled: includeHandledQuery ? undefined : "true",
                page: "1",
              })
            }}
          />
          <label htmlFor="include-handled" className="ms-2">
            Include handled requests
          </label>
        </span>
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
