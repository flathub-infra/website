"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
  ArrowUpRight,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  Minus,
  ScanSearch,
} from "lucide-react"
import type { SelectionCoverage } from "src/codegen/model/selectionCoverage"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const evidenceCellClass =
  "relative grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-x-3 py-3 pe-3 ps-9 sm:block sm:py-4 sm:pe-4 sm:ps-11"
const evidenceLabelClass =
  "row-span-2 self-start text-xs leading-5 text-muted-foreground sm:mb-1 sm:leading-4"
const evidenceIconClass = "absolute start-3 top-3.5 size-4 sm:start-4 sm:top-4"

export default function CheckerSelection({
  data,
}: {
  data?: SelectionCoverage
}) {
  const t = useTranslations("checker-selection")
  const format = useFormatter()
  function label(value: string) {
    const key = `selection-${value}`
    return t.has(key) ? t(key) : value
  }
  const decision = data?.decision
  const invocationFailed =
    data?.invocation_outcome === "failed" ||
    data?.invocation_outcome === "selection_error"
  const reportFailed =
    data?.report_status === "failed" ||
    ["missing", "invalid", "ambiguous", "conflicting_inventory"].includes(
      data?.report_state ?? "",
    )
  const SelectionIcon =
    decision?.selection === "error"
      ? CircleAlert
      : decision?.selection === "excluded"
        ? Minus
        : ScanSearch
  const InvocationIcon = invocationFailed
    ? CircleAlert
    : data?.invocation_outcome === "succeeded"
      ? CircleCheck
      : Minus
  const ReportIcon = reportFailed
    ? CircleAlert
    : data?.report_state === "available"
      ? FileText
      : CircleHelp
  const reportOutcomeKey = `selection-report-outcome-${data?.report_status}`
  const reportOutcome = data?.report_status
    ? t.has(reportOutcomeKey)
      ? t(reportOutcomeKey)
      : t("selection-report-status", { status: data.report_status })
    : label(`report-${data?.report_state ?? "unknown"}`)
  return (
    <section
      className="flex min-w-0 flex-col gap-3 [overflow-wrap:anywhere]"
      aria-label={t("selection-title")}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="font-semibold">{t("selection-title")}</h4>
          <Badge variant="outline">{label(data?.state ?? "unknown")}</Badge>
        </div>
        {data?.run_url && (
          <a
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href={data.run_url}
            target="_blank"
            rel="noreferrer"
            aria-label={t("selection-run")}
          >
            {t("selection-open-run")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        )}
      </div>
      {data?.stale && (
        <p className="text-xs text-muted-foreground">{t("selection-stale")}</p>
      )}
      {decision ? (
        <dl className="grid rounded-lg border border-border bg-muted/20 sm:grid-cols-3">
          <div className={evidenceCellClass}>
            <SelectionIcon
              className={cn(
                evidenceIconClass,
                decision.selection === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              aria-hidden
            />
            <dt className={evidenceLabelClass}>{t("selection-decision")}</dt>
            <dd className="col-start-2 font-semibold">
              {label(decision.selection)}
            </dd>
            {decision.reason && decision.reason !== "selected" && (
              <dd className="col-start-2 mt-1 text-xs text-muted-foreground">
                {label(decision.reason)}
              </dd>
            )}
            {decision.error && (
              <dd className="col-start-2 mt-1 text-xs text-muted-foreground">
                {label(decision.error)}
              </dd>
            )}
          </div>
          <div
            className={cn(
              evidenceCellClass,
              "border-t border-border sm:border-s sm:border-t-0",
            )}
          >
            <InvocationIcon
              className={cn(
                evidenceIconClass,
                invocationFailed ? "text-destructive" : "text-muted-foreground",
              )}
              aria-hidden
            />
            <dt className={evidenceLabelClass}>{t("selection-invocation")}</dt>
            <dd className="col-start-2 font-semibold">
              {data?.invocation_outcome && data.invocation_outcome !== "unknown"
                ? label(data.invocation_outcome)
                : t("selection-invocation-unknown")}
            </dd>
            {decision.invocation.exit_code !== null && (
              <dd className="col-start-2 mt-1 text-xs tabular-nums text-muted-foreground">
                {t("selection-exit-code", {
                  code: decision.invocation.exit_code,
                })}
              </dd>
            )}
          </div>
          <div
            className={cn(
              evidenceCellClass,
              "border-t border-border sm:border-s sm:border-t-0",
            )}
          >
            <ReportIcon
              className={cn(
                evidenceIconClass,
                reportFailed ? "text-destructive" : "text-muted-foreground",
              )}
              aria-hidden
            />
            <dt className={evidenceLabelClass}>{t("selection-report")}</dt>
            <dd className="col-start-2 font-semibold">{reportOutcome}</dd>
            {data?.report_status && (
              <dd className="col-start-2 mt-1 text-xs text-muted-foreground">
                {label(`report-${data?.report_state ?? "unknown"}`)}
              </dd>
            )}
          </div>
        </dl>
      ) : (
        <p className="max-w-prose text-muted-foreground">
          {t("selection-no-decision")}
        </p>
      )}
      {data?.report_status === "failed" &&
        data.invocation_outcome === "succeeded" && (
          <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
            {t("selection-exit-report-note")}
          </p>
        )}
      {!!data?.issues?.length && (
        <ul className="flex flex-col gap-1 border-s-2 border-border ps-3 text-xs leading-relaxed text-muted-foreground">
          {data.issues.map((issue) => (
            <li key={issue}>{label(issue)}</li>
          ))}
        </ul>
      )}
      <details className="group/inventory">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          <span className="font-medium">
            {t("selection-inventory-details")}
          </span>
          <span className="flex items-center gap-3 text-muted-foreground">
            {data?.expected_shards != null && (
              <span className="tabular-nums">
                {t("selection-shard-progress", {
                  received: data.received_shards ?? 0,
                  expected: data.expected_shards,
                })}
              </span>
            )}
            <ChevronDown
              className="size-4 shrink-0 group-open/inventory:rotate-180"
              aria-hidden
            />
          </span>
        </summary>
        <div className="flex flex-col gap-4 border-t border-border py-4 text-xs text-muted-foreground">
          <p className="max-w-prose leading-relaxed">{t("selection-note")}</p>
          {data && (
            <>
              <p>
                {data.scope ? label(data.scope) : t("selection-scope-unknown")}
              </p>
              <p>
                {t("selection-shards", {
                  received: data.received_shards ?? 0,
                  expected: data.expected_shards ?? "?",
                })}
              </p>
              {data.repository_count != null && (
                <p>
                  {t("selection-repositories", {
                    count: data.repository_count,
                  })}
                </p>
              )}
              {data.observed_at && (
                <p>
                  <time dateTime={data.observed_at}>
                    {t("selection-listing-time", {
                      time: format.dateTime(new Date(data.observed_at), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }),
                    })}
                  </time>
                </p>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {!!Object.keys(data.counts ?? {}).length && (
                  <div>
                    <h5 className="mb-2 font-semibold text-foreground">
                      {t("selection-decisions-heading")}
                    </h5>
                    <dl className="flex flex-col gap-2">
                      {Object.entries(data.counts ?? {}).map(
                        ([reason, count]) => (
                          <div
                            key={reason}
                            className="flex justify-between gap-3"
                          >
                            <dt>{label(reason)}</dt>
                            <dd className="tabular-nums text-foreground">
                              {format.number(count)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </div>
                )}
                {!!Object.keys(data.invocation_counts ?? {}).length && (
                  <div>
                    <h5 className="mb-2 font-semibold text-foreground">
                      {t("selection-invocations-heading")}
                    </h5>
                    <dl className="flex flex-col gap-2">
                      {Object.entries(data.invocation_counts ?? {}).map(
                        ([outcome, count]) => (
                          <div
                            key={outcome}
                            className="flex justify-between gap-3"
                          >
                            <dt>
                              {outcome === "unknown"
                                ? t("selection-invocation-unknown")
                                : label(outcome)}
                            </dt>
                            <dd className="tabular-nums text-foreground">
                              {format.number(count)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </div>
                )}
              </div>
              <p>
                {t("selection-artifacts", {
                  ids: data.artifact_ids?.join(", ") ?? "",
                })}
              </p>
              <details>
                <summary className="min-h-11 cursor-pointer rounded-sm py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {t("selection-provenance")}
                </summary>
                <pre className="rounded-md bg-muted/50 p-3 whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {JSON.stringify(
                    { inventory: data.provenance, decision },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
        </div>
      </details>
    </section>
  )
}
