"use client"

import { ReactNode, useState } from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  History,
  LoaderCircle,
  SkipForward,
  X,
} from "lucide-react"
import {
  PermissionDecisionRequestDecision as Decision,
  PermissionReviewDetail as Review,
  useDecidePermissionReviewModerationPermissionReviewsAssessmentIdDecisionPost,
  useListPermissionReviewsModerationPermissionReviewsGet,
  useReadPermissionReviewModerationPermissionReviewsAssessmentIdGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Link } from "src/i18n/navigation"
import { cn } from "@/lib/utils"
import Breadcrumbs from "../Breadcrumbs"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import PermissionDiffTable from "./PermissionDiffTable"
import OutcomeBadge from "./PermissionOutcomeBadge"
import {
  reviewListFilters,
  reviewListQuery,
  usePermissionReviewSync,
} from "./PermissionReviewList"
import {
  permissionReviewSurface,
  permissionReviewTheme,
} from "./permission-review-styles"

const Section = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <Card
    className={cn(permissionReviewSurface, "h-full min-w-0")}
    role="region"
    aria-label={title}
  >
    <CardHeader>
      <CardTitle>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      </CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

const DecisionForm = ({
  review,
  onDecided,
}: {
  review: Review
  onDecided: () => void
}) => {
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
            onDecided()
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
    return <p>This assessment cannot be reviewed.</p>
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
    <FieldGroup>
      <Field data-disabled={mutation.isPending}>
        <FieldLabel htmlFor="review-rationale">Decision rationale</FieldLabel>
        <Textarea
          id="review-rationale"
          className="min-h-32"
          value={rationale}
          disabled={mutation.isPending}
          aria-describedby="review-rationale-help"
          placeholder="Explain which permissions need attention…"
          onChange={(e) => setRationale(e.target.value)}
        />
        <FieldDescription id="review-rationale-help">
          Posted on the pull request, except when skipping. Required to reject;
          optional otherwise.
        </FieldDescription>
      </Field>
      {error && <InlineError error={error} shown={true} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <span className="text-xs text-muted-foreground" role="status">
          {mutation.isPending
            ? "Saving decision…"
            : "Review the permission changes before deciding."}
        </span>
        <div className="flex gap-2">
          <Button
            disabled={mutation.isPending}
            onClick={() => decide(Decision.approved)}
          >
            {mutation.isPending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Check data-icon="inline-start" />
            )}
            Approve
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending || !rationale.trim()}
            onClick={() => decide(Decision.rejected)}
          >
            <X data-icon="inline-start" />
            Reject
          </Button>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => decide(Decision.skipped)}
          >
            <SkipForward data-icon="inline-start" />
            Skip
          </Button>
        </div>
      </div>
    </FieldGroup>
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
            className="text-primary"
          >
            <ChevronLeft data-icon="inline-start" />
            Previous
          </Link>
        </Button>
      )}
      {next && (
        <Button variant="outline" size="sm" asChild>
          <Link
            href={`/admin/moderation/permissions/${next.assessment_id}${suffix}`}
            className="text-primary"
          >
            Next
            <ChevronRight data-icon="inline-end" />
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
  const notifyDecision = usePermissionReviewSync()
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
    ["Target branch", review.target_git_branch],
    ["Repo", review.destination_channel],
    ["Flatpak branch", review.flatpak_branch],
    [t("moderation-build-id"), review.build_id],
  ]

  return (
    <div
      className={cn(
        permissionReviewTheme,
        "flex min-w-0 flex-col gap-6 py-8 [&_[data-icon]]:size-4",
      )}
    >
      <Breadcrumbs
        pages={[
          { name: "Moderation", href: "/admin/moderation", current: false },
          {
            name: "Permission reviews",
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
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl leading-tight font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
              {review.app_id}
            </h1>
            <OutcomeBadge outcome={review.outcome} />
          </div>
          {review.pull_request_url && (
            <a
              className="inline-flex w-fit items-center gap-2 text-sm text-primary hover:underline"
              href={review.pull_request_url}
            >
              <span>
                {t("moderation-permissions-pull-request")}{" "}
                {review.source_repository}#{review.pull_request_number}
              </span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
        <NavigatePreviousNext assessmentId={assessmentId} />
      </header>
      {review.superseded_by !== null && (
        <Link href={`/admin/moderation/permissions/${review.superseded_by}`}>
          Superseded by #{review.superseded_by}
        </Link>
      )}
      {review.error_message && (
        <p className="text-flathub-status-red-dark">
          {review.error_code}: {review.error_message}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-5 rounded-xl border bg-card p-5 text-sm lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1.5 text-xs text-muted-foreground">{label}</dt>
            <dd className="break-all font-mono font-medium">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <Section title="Permission changes">
        <PermissionDiffTable
          differences={review.differences}
          source={review.comparison_source}
          snapshot={review.candidate_snapshot}
        />
      </Section>
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <Section title="Decision history">
            {review.decisions.length === 0 ? (
              <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground">
                <History className="size-5 shrink-0" aria-hidden="true" />
                No decisions yet.
              </div>
            ) : (
              <ol className="flex flex-col gap-5">
                {review.decisions.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 border-s-2 ps-4 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <OutcomeBadge outcome={d.decision} />
                      <span className="font-medium">
                        {d.reviewer_name ?? `#${d.reviewer_id}`}
                      </span>
                    </div>
                    <time
                      dateTime={d.created_at}
                      className="text-xs text-muted-foreground"
                    >
                      {d.created_at.replace("T", " · ").replace(/\.\d+/, "")}
                    </time>
                    {d.rationale && (
                      <blockquote className="leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                        {d.rationale}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <Section title="Review">
            <DecisionForm
              key={review.assessment_id}
              review={review}
              onDecided={notifyDecision}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
