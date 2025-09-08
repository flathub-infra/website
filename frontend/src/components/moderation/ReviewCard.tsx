import { useTranslations } from "next-intl"
import { FunctionComponent, ReactElement, useState } from "react"
import { getIntlLocale } from "src/localize"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import Badge from "../application/Badge"
import { formatDistanceToNow, parseISO } from "date-fns"
import { useUserContext } from "src/context/user-info"
import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import Modal from "../Modal"
import CodeCopy from "../application/CodeCopy"
import {
  submitReviewModerationRequestsIdReviewPost,
  ModerationRequestResponse,
  Permission,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/router"

interface Props {
  title: string
  request: ModerationRequestResponse
  children: ReactElement
}

const ReviewCard: FunctionComponent<Props> = ({ title, request, children }) => {
  const t = useTranslations()
  const router = useRouter()
  const i18n = getIntlLocale(router.locale)
  const user = useUserContext()

  const [modalState, setModalState] = useState<"approve" | "reject">("approve")
  const [modalVisible, setModalVisible] = useState(false)

  const [comment, setComment] = useState<string | undefined>(undefined)
  const [issueUrl, setIssueUrl] = useState<string>()

  const modalTitle = modalState === "reject" ? "Reject" : "Approve"

  const confirmText =
    modalState === "reject"
      ? "Reject"
      : comment
        ? "Approve With Comment"
        : "Approve"

  const [error, setError] = useState<string>("")

  const mutation = useMutation({
    mutationKey: ["review", request.id],
    mutationFn: (body: { approve: boolean; comment?: string }) =>
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

  const confirm = () => {
    mutation.mutate({ approve: modalState === "approve", comment: comment })
    setModalVisible(false)
    setComment(undefined)
  }

  const cancel = () => {
    setModalVisible(false)
    setComment(undefined)
  }

  let buttons: ReactElement
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
            Created github issue issue
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
      </div>
    )
  } else if (
    user.info &&
    user.info.permissions.some((a) => a === Permission.moderation)
  ) {
    buttons = (
      <>
        <Button
          size="lg"
          variant="destructive"
          className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
          onClick={() => {
            setModalState("reject")
            setModalVisible(true)
          }}
        >
          Reject
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
          onClick={() => {
            setModalState("approve")
            setModalVisible(true)
          }}
        >
          Approve With Comment
        </Button>
        <Button
          size="lg"
          className="inline-flex w-full justify-center px-3 py-2 sm:w-auto"
          onClick={() => {
            mutation.mutate({ approve: true, comment })
          }}
        >
          Approve
        </Button>
      </>
    )
  } else {
    buttons = <></>
  }

  return (
    <>
      <Modal
        shown={modalVisible}
        title={modalTitle}
        onClose={cancel}
        cancelButton={{ onClick: cancel }}
        submitButton={{
          onClick: confirm,
          label: confirmText,
          disabled: modalState === "reject" && !comment,
        }}
      >
        <Textarea
          className="h-40"
          value={comment}
          placeholder={
            modalState === "reject" ? "Comment" : "Comment (optional)"
          }
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
        />
      </Modal>

      <div className="rounded-xl bg-flathub-white p-4 pt-3 shadow-md dark:bg-flathub-arsenic">
        <span className="flex">
          <h2 className="m-0 grow pb-4 text-2xl font-bold">
            {title}
            {request.is_outdated && (
              <span className="ms-2">
                <Badge text={t("moderation-outdated")} inACard={true} />
              </span>
            )}
          </h2>
          <div className="ms-auto flex gap-2 flex-col text-sm leading-none">
            <div className="ms-auto flex gap-2">
              <span
                className="text-gray-500 dark:text-gray-400"
                title={parseISO(request.created_at + "Z").toLocaleString(
                  getIntlLocale(i18n.language),
                )}
              >
                {parseISO(request.created_at + "Z").toLocaleDateString(
                  getIntlLocale(i18n.language),
                )}
              </span>
              <Link
                id={`review-${request.id}`}
                href={`#review-${request.id}`}
                className="ms-3 text-gray-500 dark:text-gray-400"
              >
                #{request.id}
              </Link>
            </div>
            <div className="ms-auto flex gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                {t("moderation-build-id")}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {request.build_id}
              </span>
            </div>
          </div>
        </span>

        {children}

        {user.info &&
          user.info.permissions.some((a) => a === Permission.moderation) && (
            <CodeCopy
              className="mt-8"
              nested
              text={`flatpak install --user https://dl.flathub.org/build-repo/${request.build_id}/${request.app_id}.flatpakref`}
            />
          )}

        <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
          {buttons}
        </div>
      </div>
    </>
  )
}

export default ReviewCard
