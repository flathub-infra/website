import { Dialog, Transition } from "@headlessui/react"
import { useTranslation } from "next-i18next"
import { Fragment, FunctionComponent, ReactElement, useState } from "react"
import { getIntlLocale, getLocale } from "src/localize"
import Button from "../Button"
import InlineError from "../InlineError"
import Spinner from "../Spinner"
import Badge from "../application/Badge"
import { UTCDate } from "@date-fns/utc"
import { formatDistanceToNow, parseISO } from "date-fns"
import { useUserContext } from "src/context/user-info"
import Link from "next/link"
import { ModerationRequestResponse } from "src/codegen/model"
import { moderationApi } from "src/api"
import { useMutation } from "@tanstack/react-query"

interface Props {
  title: string
  request: ModerationRequestResponse
  children: ReactElement
}

const ReviewRow: FunctionComponent<Props> = ({ title, request, children }) => {
  const { t, i18n } = useTranslation()
  const user = useUserContext()

  const [modalState, setModalState] = useState<"approve" | "reject">("approve")
  const [modalVisible, setModalVisible] = useState(false)

  const [comment, setComment] = useState<string | undefined>(undefined)

  const modalTitle = modalState === "reject" ? "Reject" : "Approve"

  const confirmText =
    modalState === "reject"
      ? "Reject"
      : comment
        ? "Approve With Comment"
        : "Approve"

  const [status, setStatus] = useState<
    "idle" | "pending" | "error" | "success"
  >("idle")
  const [error, setError] = useState<string>()

  const mutation = useMutation({
    mutationKey: ["review", request.id, modalState],
    mutationFn: (body: { approve: boolean; comment?: string }) =>
      moderationApi.submitReviewModerationRequestsIdReviewPost(
        request.id,
        body,
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      setStatus("success")
    },
    onError: (e) => {
      setStatus("error")
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
  if (status === "pending") {
    buttons = <Spinner size="m" />
  } else if (status === "error") {
    buttons = <InlineError error={error} shown={true} />
  } else if (status === "success") {
    buttons = <></>
  } else if (request.handled_at) {
    const date = parseISO(request.handled_at).toLocaleDateString(
      getIntlLocale(i18n.language),
    )
    const dateRel = formatDistanceToNow(new UTCDate(request.handled_at), {
      addSuffix: true,
      locale: getLocale(i18n.language),
    })
    const message = t(
      request.is_approved ? "moderation-approved-by" : "moderation-rejected-by",
      { handledBy: request.handled_by, handledAt: date, handledAtRel: dateRel },
    )

    buttons = (
      <div>
        <div>{message}</div>
        {request.comment && (
          <blockquote className="mt-2 border-s-4 border-flathub-sonic-silver ps-2">
            {request.comment}
          </blockquote>
        )}
      </div>
    )
  } else if (user.info && user.info.is_moderator) {
    buttons = (
      <>
        <Button
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
          variant="primary"
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
      <Transition appear show={modalVisible} as={Fragment}>
        <Dialog as="div" className="z-20" onClose={cancel}>
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="inline-flex w-full flex-col justify-center space-y-6 rounded-xl bg-flathub-gainsborow p-14 shadow-md dark:bg-flathub-dark-gunmetal md:w-2/3 lg:w-1/2">
              <Dialog.Title className="m-0">{modalTitle}</Dialog.Title>

              <textarea
                className="h-40 w-full rounded-xl border border-flathub-sonic-silver p-3 dark:border-flathub-spanish-gray"
                value={comment}
                placeholder={
                  modalState === "reject" ? "Comment" : "Comment (optional)"
                }
                onInput={(e) =>
                  setComment((e.target as HTMLTextAreaElement).value)
                }
              />

              <div className="mt-3 grid grid-cols-2 gap-6">
                <Button
                  className="col-start-1"
                  onClick={cancel}
                  variant="secondary"
                  aria-label={t("cancel")}
                  title={t("cancel")}
                >
                  {t("cancel")}
                </Button>
                <Button
                  className="col-start-2"
                  onClick={confirm}
                  variant={modalState === "approve" ? "primary" : "destructive"}
                  aria-label={confirmText}
                  title={confirmText}
                  disabled={modalState === "reject" && !comment}
                >
                  {confirmText}
                </Button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      <div className="rounded-xl bg-flathub-white p-4 pt-3 shadow-md dark:bg-flathub-arsenic">
        <span className="flex">
          <h2 className="m-0 flex-grow pb-4 text-2xl font-bold">
            {title}
            {request.is_outdated && (
              <span className="ms-2">
                <Badge text={t("moderation-outdated")} inACard={true} />
              </span>
            )}
          </h2>
          <div className="ms-auto flex gap-2 flex-col text-sm leading-none">
            <div className="ms-auto flex gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                {parseISO(request.created_at).toLocaleDateString(
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

        <div className="flex flex-col sm:flex-row-reverse gap-2 pt-4">
          {buttons}
        </div>
      </div>
    </>
  )
}

export default ReviewRow
