import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { FunctionComponent, useEffect, useState } from "react"
import { getReviewRow } from "./AppModeration"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import InlineError from "../InlineError"
import { useQuery } from "@tanstack/react-query"
import { getModerationAppModerationAppsAppIdGet } from "src/codegen"

interface Props {
  appId: string
}

export const AppDevModeration: FunctionComponent<Props> = ({ appId }) => {
  const t = useTranslations()
  const searchParams = useSearchParams()

  const PAGE_SIZE = 10
  const currentPage =
    parseInt((searchParams?.get("page") ?? "1") as string) ?? 1

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  useEffect(() => {
    setOffset((currentPage - 1) * PAGE_SIZE)
  }, [currentPage])

  const query = useQuery({
    queryKey: ["moderation", appId, PAGE_SIZE, offset],
    queryFn: ({ signal }) =>
      getModerationAppModerationAppsAppIdGet(
        appId,
        {
          include_handled: true,
          include_outdated: true,
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

  if (query.isPending) {
    return <Spinner size="m" />
  } else if (query.isError) {
    return <InlineError error={t(query.error.message)} shown={true} />
  }

  const pages = Array.from(
    { length: Math.ceil((query.data.data.requests_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  return (
    <>
      <div className="mb-3">{t("moderation-dev-description")}</div>

      {query.data.data.requests.length === 0 && (
        <div>{t("moderation-no-review-requests")}</div>
      )}

      <div className="flex flex-col space-y-4">
        {query.data.data.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} useQueryParams />
    </>
  )
}
