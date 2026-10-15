"use client"

import { ReactNode, useState } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  PermissionDecisionRequestDecision as Decision,
  PermissionReviewDetail as Review,
  useDecidePermissionReviewModerationPermissionReviewsAssessmentIdDecisionPost,
  useListPermissionReviewsModerationPermissionReviewsGet,
  useReadPermissionReviewModerationPermissionReviewsAssessmentIdGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Link } from "src/i18n/navigation"
import Breadcrumbs from "../Breadcrumbs"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import PermissionDiffTable from "./PermissionDiffTable"
import { reviewListFilters, reviewListQuery } from "./PermissionReviewList"

type Finding = {
  rule_code: string
  explanation: string
  affected_permissions: { raw?: string; value: string }[]
}

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <section className="space-y-4 rounded-xl bg-flathub-white p-6 shadow-md dark:bg-flathub-arsenic">
    <h2 className="text-xl font-bold">{title}</h2>
    {children}
  </section>
)

const DecisionForm = ({ review }: { review: Review }) => {
  const t = useTranslations()
  const queryClient = useQueryClient()
  const [rationale, setRationale] = useState("")
  const [error, setError] = useState<string>()

  const mutation =
    useDecidePermissionReviewModerationPermissionReviewsAssessmentIdDecisionPost(
      {
        axios: { withCredentials: true },
        mutation: {
          onSuccess: () => {
            setRationale("")
            return queryClient.invalidateQueries()
          },
          onError: (e) => {
            const detail: unknown = isAxiosError(e) && e.response?.data?.detail
            setError(
              typeof detail === "string"
                ? detail.replaceAll("_", " ")
                : e.message,
            )
          },
        },
      },
    )

  if (
    review.superseded_by !== null ||
    review.outcome === "error" ||
    !review.snapshot_fingerprint ||
    review.acceptance_basis === "baseline"
  ) {
    return <p>{t("moderation-permissions-not-reviewable")}</p>
  }

  const decide = (decision: Decision) => {
    setError(undefined)
    mutation.mutate({
      assessmentId: review.assessment_id,
      data: {
        decision,
        fingerprint: review.snapshot_fingerprint!,
        rationale: rationale.trim() || null,
      },
    })
  }

  return (
    <div className="space-y-4">
      <Textarea
        className="h-32"
        value={rationale}
        placeholder={t("moderation-permissions-rationale")}
        onChange={(e) => setRationale(e.target.value)}
      />
      {error && <InlineError error={error} shown={true} />}
      <div className="flex gap-3">
        <Button
          disabled={mutation.isPending}
          onClick={() => decide(Decision.approved)}
        >
          {t("moderation-permissions-approve")}
        </Button>
        <Button
          variant="destructive"
          disabled={mutation.isPending || !rationale.trim()}
          onClick={() => decide(Decision.rejected)}
        >
          {t("moderation-permissions-reject")}
        </Button>
      </div>
    </div>
  )
}

const NavigatePreviousNext = ({ assessmentId }: { assessmentId: number }) => {
  const searchParams = useSearchParams()
  const { outcome, includeSuperseded } = reviewListFilters(searchParams)
  const query = useListPermissionReviewsModerationPermissionReviewsGet(
    { outcome, include_superseded: includeSuperseded, limit: 200 },
    { axios: { withCredentials: true } },
  )
  const items = (query.data?.data.items ?? []) as { assessment_id: number }[]
  const previous = items.findLast((i) => i.assessment_id > assessmentId)
  const next = items.find((i) => i.assessment_id < assessmentId)
  const suffix = reviewListQuery(searchParams)

  return (
    <div className="flex gap-2">
      {previous && (
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/admin/moderation/permissions/${previous.assessment_id}${suffix}`}
          >
            <ChevronLeft className="me-2 h-4 w-4" />
            Previous
          </Link>
        </Button>
      )}
      {next && (
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/admin/moderation/permissions/${next.assessment_id}${suffix}`}
          >
            Next
            <ChevronRight className="ms-2 h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  )
}

export default function PermissionReviewDetail({
  assessmentId,
}: {
  assessmentId: number
}) {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const query =
    useReadPermissionReviewModerationPermissionReviewsAssessmentIdGet(
      assessmentId,
      { axios: { withCredentials: true } },
    )

  if (query.isPending) {
    return <Spinner size="m" />
  } else if (query.isError) {
    return <InlineError error={t(query.error.message)} shown={true} />
  }

  const review = query.data.data
  const fields = [
    ["Built revision", review.built_revision],
    ["Head revision", review.pull_request_head_revision],
    ["Base revision", review.base_revision],
    ["Target branch", review.target_git_branch],
    ["Channel", `${review.destination_channel} / ${review.flatpak_branch}`],
    [t("moderation-build-id"), review.build_id],
  ]

  return (
    <div className="space-y-8 py-8">
      <Breadcrumbs
        pages={[
          { name: "Moderation", href: "/admin/moderation", current: false },
          {
            name: t("moderation-permissions-reviews"),
            href: `/admin/moderation/permissions${reviewListQuery(searchParams)}`,
            current: false,
          },
          {
            name: `#${assessmentId}`,
            href: `/admin/moderation/permissions/${assessmentId}`,
            current: true,
          },
        ]}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {review.app_id}{" "}
          <span className="text-xl capitalize">{review.outcome}</span>
        </h1>
        <NavigatePreviousNext assessmentId={assessmentId} />
      </div>
      {review.pull_request_url && (
        <a
          className="text-flathub-celestial-blue hover:underline"
          href={review.pull_request_url}
        >
          {t("moderation-permissions-pull-request")} {review.source_repository}#
          {review.pull_request_number}
        </a>
      )}
      {review.superseded_by !== null && (
        <Link href={`/admin/moderation/permissions/${review.superseded_by}`}>
          {t("moderation-permissions-superseded-by")} #{review.superseded_by}
        </Link>
      )}
      {review.error_message && (
        <p className="text-flathub-status-red-dark">
          {review.error_code}: {review.error_message}
        </p>
      )}
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="font-medium">{label}</dt>
            <dd className="break-all font-mono">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <Section title={t("moderation-permissions-changes")}>
        <PermissionDiffTable
          differences={review.differences}
          source={review.comparison_source}
          snapshot={review.candidate_snapshot}
        />
      </Section>
      <Section title={t("moderation-permissions-findings")}>
        {(review.review_findings as Finding[]).map((finding, i) => (
          <div key={i} className="text-sm">
            <code className="font-bold">{finding.rule_code}</code>
            <p>{finding.explanation}</p>
            {finding.affected_permissions.map((p, j) => (
              <code key={j} className="me-2">
                {p.raw ?? p.value}
              </code>
            ))}
          </div>
        ))}
      </Section>
      <Section title={t("moderation-permissions-decisions")}>
        {review.decisions.map((d) => (
          <div key={d.id} className="text-sm">
            <b className="capitalize">{d.decision}</b>{" "}
            {d.reviewer_name ?? `#${d.reviewer_id}`}, {d.created_at}
            {d.rationale && <blockquote>{d.rationale}</blockquote>}
          </div>
        ))}
      </Section>
      <Section title={t("moderation-permissions-review")}>
        <DecisionForm review={review} />
      </Section>
    </div>
  )
}
