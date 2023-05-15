import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { FunctionComponent, useCallback } from "react"
import { getAppsInfo } from "src/asyncs/app"
import { getModerationApp } from "src/asyncs/moderation"
import { useAsync } from "src/hooks/useAsync"
import { useQueryParam } from "src/hooks/useQueryParam"
import { ModerationRequest } from "src/types/Moderation"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import AppstreamChangesRow from "./AppstreamChangesRow"

interface Props {
  appId: string
}

const AppModeration: FunctionComponent<Props> = ({ appId }) => {
  const { t } = useTranslation()
  const router = useRouter()

  const [includeOutdated, setIncludeOutdated] = useQueryParam("includeOutdated")
  const [includeHandled, setIncludeHandled] = useQueryParam("includeHandled")

  const {
    error: appstreamError,
    status: appstreamStatus,
    value: appstream,
  } = useAsync(
    useCallback(async () => (await getAppsInfo([appId]))[0], [appId]),
    true,
  )

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
          appId,
          includeOutdated === "true",
          includeHandled === "true",
          PAGE_SIZE,
          (currentPage - 1) * PAGE_SIZE,
        ),
      [appId, currentPage, includeHandled, includeOutdated],
    ),
    true,
  )

  if (
    status === "pending" ||
    appstreamStatus === "pending" ||
    status === "idle" ||
    appstreamStatus === "idle"
  ) {
    return <Spinner size="m" />
  } else if (status === "error" || appstreamStatus === "error") {
    return <InlineError error={error ?? appstreamError} shown={true} />
  }

  const pages = Array.from(
    { length: Math.ceil((moderationApp.requests_count ?? 1) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mt-8 text-4xl font-extrabold">{appstream.name}</h1>
        <div className="text-sm opacity-75">{t("moderation-dashboard")}</div>
      </div>

      <div className="flex space-x-8">
        <span>
          <input
            id="include-outdated"
            type="checkbox"
            checked={includeOutdated === "true"}
            onChange={() =>
              setIncludeOutdated(includeOutdated ? undefined : "true")
            }
          />
          <label htmlFor="include-outdated" className="ml-2">
            {t("moderation-include-outdated")}
          </label>
        </span>

        <span>
          <input
            id="include-handled"
            type="checkbox"
            checked={includeHandled === "true"}
            onChange={() =>
              setIncludeHandled(includeHandled ? undefined : "true")
            }
          />
          <label htmlFor="include-handled" className="ml-2">
            {t("moderation-include-handled")}
          </label>
        </span>
      </div>

      {moderationApp.requests.length === 0 && (
        <div>{t("moderation-no-review-requests")}</div>
      )}

      <div className="flex flex-col space-y-4">
        {moderationApp.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} />
    </div>
  )
}

export default AppModeration

const getReviewRow = (request: ModerationRequest) => {
  switch (request.request_type) {
    case "appdata":
      return <AppstreamChangesRow key={request.id} request={request} />
  }
}
