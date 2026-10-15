"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import {
  ListPermissionReviewsModerationPermissionReviewsGetOutcome as Outcome,
  PermissionReviewDetail,
  useListPermissionReviewsModerationPermissionReviewsGet,
} from "src/codegen"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Link, usePathname, useRouter } from "src/i18n/navigation"
import { setQueryParams } from "src/utils/queryParams"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"

const PAGE_SIZE = 50

export const reviewListFilters = (searchParams: URLSearchParams) => ({
  outcome:
    Object.values(Outcome).find((o) => o === searchParams.get("outcome")) ??
    Outcome.pending,
  includeSuperseded: searchParams.get("includeSuperseded") === "true",
})

export const reviewListQuery = (searchParams: URLSearchParams) =>
  searchParams.size ? `?${searchParams}` : ""

export default function PermissionReviewList() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { outcome, includeSuperseded } = reviewListFilters(searchParams)
  const currentPage = parseInt(searchParams.get("page") ?? "1") || 1

  const query = useListPermissionReviewsModerationPermissionReviewsGet(
    {
      outcome,
      include_superseded: includeSuperseded,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    },
    { axios: { withCredentials: true } },
  )
  const data = query.data?.data as unknown as
    { items: PermissionReviewDetail[]; total: number } | undefined

  const setParams = (params: { [param: string]: string | undefined }) =>
    setQueryParams(router, { ...params, page: "1" }, pathname, searchParams)

  return (
    <div className="space-y-8 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">
        {t("moderation-permissions-reviews")}
      </h1>
      <div className="flex flex-wrap items-center gap-6">
        <Select
          value={outcome}
          onValueChange={(value) => setParams({ outcome: value })}
        >
          <SelectTrigger className="w-40 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.values(Outcome).map((value) => (
              <SelectItem key={value} value={value} className="capitalize">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={includeSuperseded}
            onCheckedChange={(checked) =>
              setParams({ includeSuperseded: checked ? "true" : undefined })
            }
          />
          {t("moderation-permissions-include-superseded")}
        </label>
      </div>
      {query.isPending && <Spinner size="m" />}
      {query.isError && (
        <InlineError error={t(query.error.message)} shown={true} />
      )}
      {data?.items.length === 0 && (
        <p className="text-center">{t("moderation-no-review-requests")}</p>
      )}
      {data && data.items.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-flathub-gainsborow dark:border-flathub-dark-gunmetal">
              {[
                "app",
                "pull-request",
                "branch",
                "repo",
                "flatpak-branch",
                "outcome",
              ].map((column) => (
                <th key={column} className="p-2 text-start">
                  {t(`moderation-permissions-${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr
                key={item.assessment_id}
                className="border-b border-flathub-gainsborow dark:border-flathub-dark-gunmetal"
              >
                <td className="p-2">
                  <Link
                    href={`/admin/moderation/permissions/${item.assessment_id}${reviewListQuery(searchParams)}`}
                    className="font-mono text-flathub-celestial-blue hover:underline"
                  >
                    {item.app_id}
                  </Link>
                </td>
                <td className="p-2">
                  {item.pull_request_url ? (
                    <a href={item.pull_request_url}>
                      #{item.pull_request_number}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="p-2 font-mono text-xs">
                  {item.target_git_branch}
                </td>
                <td className="p-2 font-mono text-xs">
                  {item.destination_channel}
                </td>
                <td className="p-2 font-mono text-xs">{item.flatpak_branch}</td>
                <td className="p-2 capitalize">
                  {item.outcome}
                  {item.superseded_by !== null && " (superseded)"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pagination
        currentPage={currentPage}
        pages={Array.from(
          { length: Math.ceil((data?.total ?? 0) / PAGE_SIZE) },
          (_, i) => i + 1,
        )}
        useQueryParams
      />
    </div>
  )
}
