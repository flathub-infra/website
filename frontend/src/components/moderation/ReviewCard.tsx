import { useLocale, useTranslations } from "next-intl"
import { FunctionComponent, ReactElement, ReactNode, useState } from "react"
import { getIntlLocale } from "src/localize"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import Tag from "../application/Tag"
import { formatDistanceToNow, parseISO } from "date-fns"
import { useUserContext } from "src/context/user-info"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Modal from "../Modal"
import CodeCopy from "../application/CodeCopy"
import {
  submitReviewModerationRequestsIdReviewPost,
  submitDiscussionModerationRequestsIdDiscussionPost,
  ModerationRequestResponse,
  Permission,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Link } from "src/i18n/navigation"
import { Check, Clock, ExternalLink, MessagesSquareIcon, X } from "lucide-react"

interface Props {
  title: string
  requests: ModerationRequestResponse[]
  children: ReactNode
}

const ReviewCard: FunctionComponent<Props> = ({
  title,
  requests,
  children,
}) => {
  const t = useTranslations()
  const locale = useLocale()
  const i18n = getIntlLocale(locale)
  const user = useUserContext()
  const request =
    requests.find((groupedRequest) => !groupedRequest.handled_at) ?? requests[0]

  const queryClient = useQueryClient()
  const [modal, setModal] = useState<"discuss" | null>(null)
  const [reviewComment, setReviewComment] = useState("")
  const [internalComment, setInternalComment] = useState("")

  const [comment, setComment] = useState<string | undefined>(undefined)
  const [issueUrl, setIssueUrl] = useState<string>()

  const [error, setError] = useState<string>("")

  const mutation = useMutation({
    mutationKey: ["review", request.id],
    mutationFn: (body: {
      approve: boolean
      comment: string | null
      internal_comment: string | null
    }) =>
      submitReviewModerationRequestsIdReviewPost(request.id, body, {
        withCredentials: true,
      }),
    onSuccess: (data) => {
      setIssueUrl(data.data?.github_issue_url)
    },
    onError: (e) => {
      setError(e as unknown as string)
    },
  })

  const discussionMutation = useMutation({
    mutationKey: ["discussion", request.id],
    mutationFn: (body: { comment: string }) =>
      submitDiscussionModerationRequestsIdDiscussionPost(request.id, body, {
        withCredentials: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["moderation", request.app_id],
      })
      setModal(null)
      setComment(undefined)
    },
  })

  const discussionRequest = requests.find(
    (groupedRequest) => groupedRequest.discussion_url,
  )
  const discussionUrl =
    discussionMutation.data?.data.github_issue_url ??
    discussionRequest?.discussion_url

  const decide = (approve: boolean) => {
    mutation.mutate({
      approve,
      comment: reviewComment.trim() || null,
      internal_comment: internalComment.trim() || null,
    })
  }

  const confirmDiscussion = () => {
    if (comment?.trim()) {
      discussionMutation.mutate({ comment })
    }
  }

  const cancel = () => {
    setModal(null)
    setComment(undefined)
    if (discussionMutation.isError) {
      discussionMutation.reset()
    }
  }

  let buttons: ReactElement
  let reviewForm: ReactElement | null = null
  if (mutation.isPending) {
    buttons = <Spinner size="m" />
  } else if (mutation.isError) {
    buttons = <InlineError error={error} shown={true} />
  } else if (mutation.isSuccess) {
    buttons = (
      <>
        {issueUrl && (
          <a
            href={issueUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm no-underline hover:underline"
          >
            Created GitHub issue
          </a>
        )}
      </>
    )
  } else if (request.handled_at) {
    const date = parseISO(request.handled_at + "Z")
    const dateRel = formatDistanceToNow(date, {
      addSuffix: true,
    })
    const message = t(
      request.handled_by
        ? request.is_approved
          ? "moderation-approved-by"
          : "moderation-rejected-by"
        : request.is_approved
          ? "moderation-approved-on"
          : "moderation-rejected-on",
      {
        handledBy: request.handled_by,
        handledAt: date.toLocaleDateString(getIntlLocale(i18n.language)),
        handledAtRel: dateRel,
      },
    )

    buttons = (
      <div className="text-sm text-muted-foreground">
        <div title={date.toLocaleString(getIntlLocale(i18n.language))}>
          {message}
        </div>
        {request.comment && (
          <blockquote className="mt-2 border-s-4 border-flathub-sonic-silver ps-2">
            {request.comment}
          </blockquote>
        )}
        {request.internal_comment && (
          <div className="mt-2 text-sm">
            <div>Internal note</div>
            <blockquote className="mt-1 border-s-4 border-flathub-sonic-silver ps-2">
              {request.internal_comment}
            </blockquote>
          </div>
        )}
      </div>
    )
  } else if (
    user.info &&
    user.info.permissions.some((a) => a === Permission.moderation)
  ) {
    reviewForm = (
      <FieldGroup className="mb-5 grid gap-5 md:grid-cols-[3fr_2fr]">
        <Field className="gap-2">
          <FieldLabel htmlFor={`review-comment-${request.id}`}>
            Review comment
          </FieldLabel>
          <Textarea
            id={`review-comment-${request.id}`}
            variant="surface"
            className="min-h-24 resize-y"
            value={reviewComment}
            aria-describedby={`review-comment-help-${request.id}`}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <FieldDescription
            className="m-0"
            id={`review-comment-help-${request.id}`}
          >
            Sent to the developers with the decision. Required to reject;
            optional to approve.
          </FieldDescription>
        </Field>
        <Field className="gap-2">
          <FieldLabel htmlFor={`internal-comment-${request.id}`}>
            Internal note
          </FieldLabel>
          <Textarea
            id={`internal-comment-${request.id}`}
            variant="surface"
            className="min-h-24 resize-y"
            value={internalComment}
            aria-describedby={`internal-comment-help-${request.id}`}
            onChange={(e) => setInternalComment(e.target.value)}
          />
          <FieldDescription
            className="m-0"
            id={`internal-comment-help-${request.id}`}
          >
            Visible only to moderators. Optional.
          </FieldDescription>
        </Field>
      </FieldGroup>
    )
    buttons = (
      <>
        <Button
          size="lg"
          variant="destructive"
          className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
          disabled={discussionMutation.isPending || !reviewComment.trim()}
          onClick={() => decide(false)}
        >
          Reject
        </Button>
        <Button
          size="lg"
          className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
          disabled={discussionMutation.isPending}
          onClick={() => decide(true)}
        >
          Approve
        </Button>
        {request.can_open_discussion && !discussionUrl && (
          <Button
            size="lg"
            variant="secondary"
            className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
            disabled={discussionMutation.isPending}
            onClick={() => {
              setModal("discuss")
            }}
          >
            Open discussion
          </Button>
        )}
      </>
    )
  } else {
    buttons = <></>
  }

  return (
    <>
      <Modal
        shown={modal === "discuss"}
        title="Open discussion"
        description="Open a GitHub issue with your comment. The build stays withheld until a review decision."
        onClose={cancel}
        cancelButton={{ onClick: cancel }}
        submitButton={{
          onClick: confirmDiscussion,
          label: "Open discussion",
          disabled: !comment?.trim() || discussionMutation.isPending,
        }}
      >
        <label
          htmlFor={`discussion-comment-${request.id}`}
          className="mb-2 block text-sm font-medium"
        >
          Comment
        </label>
        <Textarea
          id={`discussion-comment-${request.id}`}
          variant="surface"
          className="h-40"
          value={comment ?? ""}
          placeholder="Comment"
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
        />
        <InlineError
          shown={discussionMutation.isError}
          error={discussionMutation.error?.message ?? ""}
        />
      </Modal>

      <div className="overflow-hidden rounded-xl bg-flathub-white text-card-foreground shadow-sm dark:bg-flathub-arsenic [--muted-foreground:var(--flathub-granite-gray)] dark:[--muted-foreground:var(--flathub-gray-x11)]">
        <div className="border-b border-border p-[clamp(18px,2.5vw,28px)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {request.handled_at || mutation.isSuccess ? (
                  request.is_approved ||
                  (mutation.isSuccess && mutation.variables.approve) ? (
                    <Check
                      className="size-4 text-flathub-status-green dark:text-flathub-status-green-dark"
                      aria-hidden
                    />
                  ) : (
                    <X className="size-4 text-destructive" aria-hidden />
                  )
                ) : (
                  <Clock className="size-4" aria-hidden />
                )}
                {t(
                  request.handled_at || mutation.isSuccess
                    ? request.is_approved ||
                      (mutation.isSuccess && mutation.variables.approve)
                      ? "moderation-approved"
                      : "moderation-rejected"
                    : "status-pending",
                )}
              </div>
              <h2 className="text-xl font-semibold leading-tight tracking-tight">
                {title}
                {request.is_outdated && (
                  <span className="ms-2 inline-block align-middle">
                    <Tag text={t("moderation-outdated")} inACard={true} />
                  </span>
                )}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-muted-foreground">
                  {t("moderation-build-id")}:
                </span>
                <span className="rounded bg-flathub-gainsborow px-2.5 py-1 font-mono text-xs font-medium dark:bg-flathub-dark-gunmetal">
                  {request.build_id}
                </span>
                {request.build_log_url && (
                  <a
                    className="inline-flex items-center gap-1 text-flathub-celestial-blue hover:underline dark:text-flathub-celestial-blue"
                    href={request.build_log_url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("moderation-build-log")}
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-sm">
              <span
                className="text-muted-foreground"
                title={parseISO(request.created_at + "Z").toLocaleString(
                  getIntlLocale(i18n.language),
                )}
              >
                {parseISO(request.created_at + "Z").toLocaleDateString(
                  getIntlLocale(i18n.language),
                )}
              </span>
              <div className="flex flex-wrap justify-end gap-x-2">
                {requests.map((groupedRequest) => (
                  <Link
                    id={`review-${groupedRequest.id}`}
                    key={groupedRequest.id}
                    href={`#review-${groupedRequest.id}`}
                    className="font-mono text-xs text-flathub-celestial-blue-dark hover:underline dark:text-flathub-celestial-blue-light"
                  >
                    #{groupedRequest.id}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-[clamp(18px,2.5vw,28px)]">{children}</div>

        {user.info &&
          user.info.permissions.some((a) => a === Permission.moderation) && (
            <details className="mx-[clamp(18px,2.5vw,28px)] mb-[clamp(18px,2.5vw,28px)] rounded-lg bg-muted/40">
              <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium marker:text-muted-foreground hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Install this build for testing
              </summary>
              <div className="px-3 pb-3">
                <CodeCopy
                  nested
                  text={`flatpak install --user https://dl.flathub.org/build-repo/${request.build_id}/${request.app_id}.flatpakref`}
                />
              </div>
            </details>
          )}

        {(request.handled_at ||
          reviewForm ||
          discussionUrl ||
          mutation.isPending ||
          mutation.isError ||
          mutation.isSuccess) && (
          <div className="border-t border-border p-[clamp(18px,2.5vw,28px)]">
            {discussionUrl && (
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  {discussionRequest?.discussion_opened_by && (
                    <>
                      <div>
                        {t("moderation-discussion-opened-by", {
                          openedBy: discussionRequest.discussion_opened_by,
                        })}
                      </div>
                      {discussionRequest.discussion_comment && (
                        <blockquote className="mt-2 border-s-4 border-flathub-sonic-silver ps-2">
                          {discussionRequest.discussion_comment}
                        </blockquote>
                      )}
                    </>
                  )}
                </div>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full px-3 py-2 sm:w-auto"
                >
                  <a href={discussionUrl} rel="noreferrer" target="_blank">
                    <MessagesSquareIcon className="h-4 w-4" />
                    {t("moderation-view-discussion")}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            )}
            {reviewForm}
            <div
              data-handled={!!request.handled_at}
              className="flex flex-col gap-3 sm:flex-row-reverse sm:flex-wrap sm:data-[handled=true]:flex-row"
            >
              {buttons}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default ReviewCard
