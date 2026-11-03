import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { FunctionComponent } from "react"
import { CheckCheck } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { usePathname, useRouter } from "src/i18n/navigation"
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
  const pathname = usePathname()
  const router = useRouter()
  const includeHistory = searchParams.get("reviewHistory") === "true"

  const PAGE_SIZE = 10
  const parsedPage = Number(searchParams.get("page") ?? 1)
  const currentPage =
    Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const offset = (currentPage - 1) * PAGE_SIZE

  const query = useQuery({
    queryKey: ["moderation", appId, includeHistory, PAGE_SIZE, offset],
    queryFn: ({ signal }) =>
      getModerationAppModerationAppsAppIdGet(
        appId,
        {
          include_handled: includeHistory,
          include_outdated: includeHistory,
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

  const pages = Array.from(
    { length: Math.ceil((query.data?.data.requests_count ?? 0) / PAGE_SIZE) },
    (_, i) => i + 1,
  )

  return (
    <>
      <div className="mb-6 flex flex-col gap-5">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("moderation-dev-description")}
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={includeHistory}
            onCheckedChange={(checked) => {
              const params = new URLSearchParams(searchParams.toString())
              params.delete("page")
              if (checked === true) {
                params.set("reviewHistory", "true")
              } else {
                params.delete("reviewHistory")
              }
              router.replace(`${pathname}?${params.toString()}`, {
                scroll: false,
              })
            }}
          />
          {t("app-management.review-history")}
        </label>
      </div>
      {query.isPending && <Spinner size="m" />}
      {query.isError && (
        <InlineError error={t(query.error.message)} shown={true} />
      )}

      {query.isSuccess && query.data.data.requests.length === 0 && (
        <div
          className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 border-t border-border py-4"
          role="status"
        >
          <CheckCheck
            className="row-span-2 size-6 text-foreground"
            aria-hidden
          />
          <p className="col-start-2 font-semibold">
            {t(
              includeHistory
                ? "moderation-no-review-requests"
                : "app-management.no-pending-reviews",
            )}
          </p>
          {!includeHistory && (
            <p className="col-start-2 text-sm leading-relaxed text-muted-foreground">
              {t("app-management.no-pending-description")}
            </p>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        {query.data?.data.requests.map(getReviewRow)}
      </div>

      <Pagination currentPage={currentPage} pages={pages} useQueryParams />
    </>
  )
}
