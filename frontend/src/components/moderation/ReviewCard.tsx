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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Link, useRouter } from "src/i18n/navigation"
import { ExternalLink, MessagesSquareIcon } from "lucide-react"

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
  const router = useRouter()
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
      request.is_approved ? "moderation-approved-by" : "moderation-rejected-by",
      {
        handledBy: request.handled_by,
        handledAt: date.toLocaleDateString(getIntlLocale(i18n.language)),
        handledAtRel: dateRel,
      },
    )

    buttons = (
      <div>
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
      <div className="mb-3 flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor={`review-comment-${request.id}`}>
            Review comment
          </FieldLabel>
          <Textarea
            id={`review-comment-${request.id}`}
            className="min-h-32"
            value={reviewComment}
            aria-describedby={`review-comment-help-${request.id}`}
            onChange={(e) => setReviewComment(e.target.value)}
          />
          <FieldDescription id={`review-comment-help-${request.id}`}>
            Sent to the developers with the decision. Required to reject;
            optional to approve.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor={`internal-comment-${request.id}`}>
            Internal note
          </FieldLabel>
          <Textarea
            id={`internal-comment-${request.id}`}
            className="min-h-20"
            value={internalComment}
            aria-describedby={`internal-comment-help-${request.id}`}
            onChange={(e) => setInternalComment(e.target.value)}
          />
          <FieldDescription id={`internal-comment-help-${request.id}`}>
            Visible only to moderators. Optional.
          </FieldDescription>
        </Field>
      </div>
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

      <div className="rounded-xl bg-flathub-white p-6 shadow-md dark:bg-flathub-arsenic">
        <div className="mb-6 border-b border-flathub-gainsborow pb-6 dark:border-flathub-dark-gunmetal">
          <div className="flex sm:gap-4 flex-row justify-between align-middle">
            <div className="flex-1">
              <h2 className="text-2xl leading-none font-bold">
                {title}
                {request.is_outdated && (
                  <span className="ms-2 inline-block align-middle">
                    <Tag text={t("moderation-outdated")} inACard={true} />
                  </span>
                )}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-flathub-sonic-silver dark:text-flathub-spanish-gray">
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
                className="text-flathub-sonic-silver dark:text-flathub-spanish-gray"
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
                    className="font-mono text-xs text-flathub-celestial-blue hover:underline dark:text-flathub-celestial-blue"
                  >
                    #{groupedRequest.id}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {children}

        {user.info &&
          user.info.permissions.some((a) => a === Permission.moderation) && (
            <div className="mt-6 border-t border-flathub-gainsborow pt-6 dark:border-flathub-dark-gunmetal">
              <CodeCopy
                nested
                text={`flatpak install --user https://dl.flathub.org/build-repo/${request.build_id}/${request.app_id}.flatpakref`}
              />
            </div>
          )}

        <div className="mt-6 border-t border-flathub-gainsborow pt-6 dark:border-flathub-dark-gunmetal">
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
          <div className="flex flex-col gap-3 sm:flex-row-reverse">
            {buttons}
          </div>
        </div>
      </div>
    </>
  )
}

export default ReviewCard
