import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useEffect, useState } from "react"
import { Appstream } from "src/types/Appstream"
import { getReviewRow } from "./AppModeration"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import InlineError from "../InlineError"
import { useQuery } from "@tanstack/react-query"
import { moderationApi } from "src/api"

interface Props {
  app: Appstream
}

export const AppDevModeration: FunctionComponent<Props> = ({ app }) => {
  const router = useRouter()
  const { t } = useTranslation()

  const PAGE_SIZE = 10
  const currentPage = parseInt((router.query.page as string) ?? "1") ?? 1

  const [offset, setOffset] = useState((currentPage - 1) * PAGE_SIZE)

  useEffect(() => {
    setOffset((currentPage - 1) * PAGE_SIZE)
  }, [currentPage])

  const query = useQuery({
    queryKey: ["moderation", app.id, offset],
    queryFn: ({ signal }) =>
      moderationApi.getModerationAppModerationAppsAppIdGet(
        app.id,
        true,
        true,
        PAGE_SIZE,
        offset,
        {
          withCredentials: true,
          signal,
        },
      ),
    enabled: !!app.id,
  })

  if (query.isLoading) {
    return <Spinner size="m" />
  } else if (query.isError) {
    return <InlineError error={t(query.error as string)} shown={true} />
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

      <Pagination currentPage={currentPage} pages={pages} />
    </>
  )
}
