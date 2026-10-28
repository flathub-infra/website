"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { ArrowUpRight, ExternalLink } from "lucide-react"
import {
  ListPermissionReviewsModerationPermissionReviewsGetOutcome as Outcome,
  PermissionReviewDetail,
  useListPermissionReviewsModerationPermissionReviewsGet,
} from "src/codegen"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Link, usePathname, useRouter } from "src/i18n/navigation"
import { setQueryParams } from "src/utils/queryParams"
import { cn } from "@/lib/utils"
import InlineError from "../InlineError"
import Pagination from "../Pagination"
import Spinner from "../Spinner"
import OutcomeBadge from "./PermissionOutcomeBadge"
import {
  permissionReviewSurface,
  permissionReviewTheme,
} from "./permission-review-styles"

const PAGE_SIZE = 50
const tableCellClassName = "min-w-0 p-0 whitespace-normal md:px-5 md:py-3"
const labeledTableCellClassName = cn(
  tableCellClassName,
  "before:mb-1 before:block before:text-xs before:text-muted-foreground before:content-[attr(data-label)] md:before:hidden",
)

export const reviewListFilters = (searchParams: URLSearchParams) => ({
  outcome:
    Object.values(Outcome).find((o) => o === searchParams.get("outcome")) ??
    Outcome.pending,
  includeSuperseded: searchParams.get("includeSuperseded") === "true",
  automatic: searchParams.get("automatic") === "true",
})

export const reviewListQuery = (searchParams: URLSearchParams) =>
  searchParams.size ? `?${searchParams}` : ""

export const usePermissionReviewSync = () => {
  const queryClient = useQueryClient()
  const channel = useRef<BroadcastChannel>(null)
  useEffect(() => {
    const current = new BroadcastChannel("permission-reviews")
    current.onmessage = () => queryClient.invalidateQueries()
    channel.current = current
    return () => current.close()
  }, [queryClient])
  return () => channel.current?.postMessage(null)
}

export default function PermissionReviewList() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { outcome, includeSuperseded, automatic } =
    reviewListFilters(searchParams)
  const currentPage = parseInt(searchParams.get("page") ?? "1") || 1

  usePermissionReviewSync()
  const query = useListPermissionReviewsModerationPermissionReviewsGet(
    {
      outcome,
      include_superseded: includeSuperseded,
      automatic,
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
    <div
      className={cn(permissionReviewTheme, "flex min-w-0 flex-col gap-6 py-8")}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Permission reviews
        </h1>
        <p className="mb-0 text-sm text-muted-foreground">
          Review changes to app sandbox permissions.
        </p>
      </header>
      <section
        className={cn(permissionReviewSurface, "overflow-hidden")}
        aria-label="Permission assessments"
      >
        <div className="flex flex-wrap items-end justify-between gap-5 border-b p-5">
          <FieldGroup className="w-full flex-row flex-wrap items-end gap-x-6 gap-y-4 md:w-auto md:flex-nowrap">
            <Field className="w-40 shrink-0 gap-2">
              <FieldLabel htmlFor="review-outcome">Outcome</FieldLabel>
              <Select
                value={outcome}
                onValueChange={(value) => setParams({ outcome: value })}
              >
                <SelectTrigger id="review-outcome" className="w-40 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.values(Outcome).map((value) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="capitalize"
                      >
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal" className="w-full pb-2 sm:w-auto">
              <Checkbox
                id="automatic-decisions"
                checked={automatic}
                onCheckedChange={(checked) =>
                  setParams({ automatic: checked ? "true" : undefined })
                }
              />
              <FieldLabel
                htmlFor="automatic-decisions"
                className="whitespace-nowrap"
              >
                Show only automatic decisions
              </FieldLabel>
            </Field>
            <Field orientation="horizontal" className="w-full pb-2 sm:w-auto">
              <Checkbox
                id="include-superseded"
                checked={includeSuperseded}
                onCheckedChange={(checked) =>
                  setParams({ includeSuperseded: checked ? "true" : undefined })
                }
              />
              <FieldLabel
                htmlFor="include-superseded"
                className="whitespace-nowrap"
              >
                Include superseded assessments
              </FieldLabel>
            </Field>
          </FieldGroup>
          <div
            className="pb-2 text-xs text-muted-foreground tabular-nums"
            role="status"
            aria-live="polite"
          >
            {query.isFetching
              ? "Loading assessments…"
              : data
                ? data.total === 0
                  ? "0 assessments"
                  : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, data.total)} of ${data.total} assessments`
                : null}
          </div>
        </div>
        {query.isPending && (
          <div className="p-12" role="status" aria-label="Loading assessments">
            <Spinner size="m" />
          </div>
        )}
        {query.isError && (
          <div className="p-5">
            <InlineError error={t(query.error.message)} shown={true} />
          </div>
        )}
        {data?.items.length === 0 && (
          <p className="mb-0 px-5 py-16 text-center text-muted-foreground">
            {t("moderation-no-review-requests")}
          </p>
        )}
        {data && data.items.length > 0 && (
          <Table className="block md:table">
            <caption className="sr-only">
              Permission assessments, filtered by {outcome} outcome
              {automatic ? ", decided automatically" : ""}
            </caption>
            <TableHeader className="hidden md:table-header-group">
              <TableRow>
                {[
                  "App",
                  "Pull request",
                  "Branch",
                  "Repo",
                  "Flatpak branch",
                  "Outcome",
                ].map((column) => (
                  <TableHead
                    key={column}
                    scope="col"
                    className="bg-muted/40 px-5 py-3 text-xs font-medium first:w-[44%]"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="block md:table-row-group">
              {data.items.map((item) => (
                <TableRow
                  key={item.assessment_id}
                  className="grid grid-cols-3 gap-x-3 gap-y-4 border-border/50 p-5 md:table-row md:p-0"
                >
                  <TableCell className={cn(tableCellClassName, "col-span-3")}>
                    <Link
                      href={`/admin/moderation/permissions/${item.assessment_id}${reviewListQuery(searchParams)}`}
                      className="group flex items-center gap-3 text-foreground hover:text-primary"
                    >
                      <span className="min-w-0 flex-1 font-mono text-[13px] [overflow-wrap:anywhere]">
                        {item.app_id}
                      </span>
                      <ArrowUpRight
                        className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </TableCell>
                  <TableCell
                    data-label="Pull request"
                    className={cn(
                      labeledTableCellClassName,
                      "col-span-2 row-start-2",
                    )}
                  >
                    {item.pull_request_url ? (
                      <a
                        href={item.pull_request_url}
                        className="inline-flex items-center gap-1.5 text-sm text-primary tabular-nums hover:underline"
                        aria-label={`Pull request #${item.pull_request_number} for ${item.app_id}`}
                      >
                        #{item.pull_request_number}
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell
                    data-label="Branch"
                    className={cn(labeledTableCellClassName, "row-start-3")}
                  >
                    <span className="font-mono text-xs">
                      {item.target_git_branch}
                    </span>
                  </TableCell>
                  <TableCell
                    data-label="Repo"
                    className={cn(labeledTableCellClassName, "row-start-3")}
                  >
                    <span className="font-mono text-xs">
                      {item.destination_channel}
                    </span>
                  </TableCell>
                  <TableCell
                    data-label="Flatpak branch"
                    className={cn(labeledTableCellClassName, "row-start-3")}
                  >
                    <span className="font-mono text-xs">
                      {item.flatpak_branch}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      tableCellClassName,
                      "col-start-3 row-start-2",
                    )}
                  >
                    <div className="flex flex-col items-end gap-1.5 md:items-start">
                      <OutcomeBadge outcome={item.outcome} />
                      {item.superseded_by !== null && (
                        <span className="text-xs text-muted-foreground">
                          Superseded
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      {data && data.total > PAGE_SIZE && (
        <div className="[&_nav]:mt-0">
          <Pagination
            currentPage={currentPage}
            pages={Array.from(
              { length: Math.ceil((data?.total ?? 0) / PAGE_SIZE) },
              (_, i) => i + 1,
            )}
            useQueryParams
          />
        </div>
      )}
    </div>
  )
}
