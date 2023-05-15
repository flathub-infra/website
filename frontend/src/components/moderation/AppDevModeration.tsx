import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useCallback } from "react"
import { getModerationApp } from "src/asyncs/moderation"
import { useAsync } from "src/hooks/useAsync"
import { Appstream } from "src/types/Appstream"
import { getReviewRow } from "./AppModeration"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import InlineError from "../InlineError"

interface Props {
  app: Appstream
}

export const AppDevModeration: FunctionComponent<Props> = ({ app }) => {
  const router = useRouter()
  const { t } = useTranslation()

  const PAGE_SIZE = 10
  const currentPage = parseInt((router.query.page as string) ?? "1") ?? 1

  const {
    error,
    status,
    value: moderationApp,
  } = useAsync(
    useCallback(
      async () =>
        await getModerationApp(
          app.id,
          true,
          true,
          PAGE_SIZE,
          (currentPage - 1) * PAGE_SIZE,
        ),
      [app.id, currentPage],
    ),
    true,
  )

  if (status === "pending" || status === "idle") {
    return <Spinner size="m" />
  } else if (status === "error") {
    return <InlineError error={error} shown={true} />
  }

  const pages = Array.from(
    { length: Math.ceil((moderationApp.requests_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  return (
    <>
      <div className="mb-3">{t("moderation-dev-description")}</div>

      {moderationApp.requests.length === 0 && (
        <div>{t("moderation-no-review-requests")}</div>
      )}

      <div className="flex flex-col space-y-4">
        {moderationApp.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} />
    </>
  )
}
