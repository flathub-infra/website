import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useUserContext } from "src/context/user-info"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import Spinner from "../Spinner"
import clsx from "clsx"
import { useTranslations } from "next-intl"
import Modal from "../Modal"
import {
  Permission,
  QualityModerationStatus,
  useGetQualityModerationStatusForAppQualityModerationAppIdStatusGet,
  useGetModerationAppModerationAppsAppIdGet,
  useRequestReviewForAppQualityModerationAppIdRequestReviewPost,
  DesktopAppstream,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import {
  CircleCheckIcon,
  CircleQuestionMarkIcon,
  ClipboardCheckIcon,
  EyeIcon,
  MailIcon,
  MailOpenIcon,
  ScanEyeIcon,
  SettingsIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Link } from "src/i18n/navigation"

const QualityModerationStatusComponent = ({
  status,
}: {
  status: undefined | QualityModerationStatus
}) => {
  const t = useTranslations()

  if (!status) {
    return null
  }

  if (status.passes) {
    return (
      <div className="flex gap-1">
        <CircleCheckIcon className="text-2xl size-6" />
        <span>{t("quality-guideline.high-quality-app-data")}</span>
      </div>
    )
  } else if (status.not_passed === 0) {
    return (
      <div className="flex gap-1">
        <CircleQuestionMarkIcon className="text-2xl size-6" />
        <span>{t("quality-guideline.app-data-review-pending")}</span>
      </div>
    )
  } else {
    return (
      <div className="flex gap-1">
        <TriangleAlertIcon className="text-2xl size-6" />
        <span>
          {t("quality-guideline.failing-x-checks", {
            count: status.not_passed,
          })}
        </span>
      </div>
    )
  }
}

const QualityReviewButton = ({
  review_requested_at,
  status,
  app_id,
  mode,
}: {
  review_requested_at?: string
  status?: QualityModerationStatus
  app_id: string
  mode?: "qualityModerator" | "readOnly"
}) => {
  const t = useTranslations()
  const queryClient = useQueryClient()

  const [modalVisible, setModalVisible] = useState(false)

  const requestReviewMutation =
    useRequestReviewForAppQualityModerationAppIdRequestReviewPost({
      mutation: {
        onSuccess: (data) => {
          queryClient.setQueryData(
            [`/quality-moderation/${app_id}/status`],
            data,
          )
          setModalVisible(false)
        },
      },
      axios: { withCredentials: true },
    })

  if (status?.passes) {
    return null
  }

  if (mode === "qualityModerator" && !review_requested_at) {
    return null
  }

  if (!review_requested_at) {
    return (
      <Button
        size="lg"
        className="me-2"
        variant="secondary"
        onClick={() => {
          setModalVisible(true)
        }}
      >
        <MailOpenIcon className="size-5" />
        <div className="hidden sm:block">
          {t("quality-guideline.request-review")}
        </div>

        <Modal
          shown={modalVisible}
          onClose={() => setModalVisible(false)}
          title={t("quality-guideline.request-a-review-question")}
          cancelButton={{
            onClick: () => {
              setModalVisible(false)
            },
          }}
          submitButton={{
            onClick: () => {
              requestReviewMutation.mutate({
                appId: app_id,
              })
            },
            label: t("quality-guideline.request-review"),
          }}
        >
          <span>{t("quality-guideline.request-review-description")}</span>
        </Modal>
      </Button>
    )
  }

  return (
    <Button size="lg" className="me-2" variant="secondary" disabled>
      <MailIcon className="size-5" />
      <div className="hidden sm:block">
        {t("quality-guideline.review-requested")}
      </div>
    </Button>
  )
}

export const QualityModeration = ({
  app,
  isQualityModalOpen,
  setIsQualityModalOpen,
}: {
  app: DesktopAppstream
  isQualityModalOpen: boolean
  setIsQualityModalOpen: (isOpen: boolean) => void
}) => {
  const t = useTranslations()
  const user = useUserContext()
  const isQualityModerator = user.info?.permissions?.includes(
    Permission["quality-moderation"],
  )
  const isModerator = user.info?.permissions?.includes(Permission.moderation)
  const isDeveloper = user.info?.dev_flatpaks?.includes(app.id)
  const canViewQualityStatus = !!(isQualityModerator || isDeveloper)
  const canViewQualityDetails = canViewQualityStatus || isModerator
  const canManageApp =
    isDeveloper || user.info?.permissions?.includes(Permission["manage-apps"])

  const query =
    useGetQualityModerationStatusForAppQualityModerationAppIdStatusGet(app.id, {
      axios: { withCredentials: true },
      query: {
        enabled: canViewQualityStatus,
        retry: (failureCount, error: any) =>
          error?.response?.status !== 404 && failureCount < 3,
      },
    })

  const moderationStatusQuery = useGetModerationAppModerationAppsAppIdGet(
    app.id,
    {
      limit: 1,
      include_handled: false,
      include_outdated: false,
      offset: 0,
    },
    {
      axios: { withCredentials: true },
      query: {
        enabled: !!isModerator,
      },
    },
  )

  const canReviewModeration =
    isModerator &&
    moderationStatusQuery.isSuccess &&
    moderationStatusQuery.data.data.requests_count > 0

  if (!canViewQualityDetails && !canManageApp) {
    return null
  }

  const errorStatus = (query.error as any)?.response?.status
  const errorDetail = (query.error as any)?.response?.data?.detail
  const is404 = query.isError && errorStatus === 404
  const isExcluded = is404 && errorDetail === "App excluded from app picks"
  const isGeneric404 = is404 && !isExcluded

  const mode = isQualityModerator ? "qualityModerator" : "readOnly"

  return (
    <>
      <div
        className={clsx(
          "flex px-8 h-16 items-center",
          !canViewQualityStatus || isExcluded
            ? "bg-flathub-gainsborow/40"
            : isGeneric404
              ? "bg-flathub-electric-red/40"
              : query.data?.data.passes
                ? "bg-flathub-celestial-blue/40"
                : query.data?.data["not_passed"] === 0
                  ? "bg-flathub-gainsborow/40"
                  : "bg-flathub-electric-red/40",
        )}
      >
        {canViewQualityStatus && (
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center">
              {query.isPending ? (
                <Spinner size={"s"} orientation="row" />
              ) : isExcluded ? (
                <div className="flex gap-1">
                  <CircleQuestionMarkIcon className="text-2xl size-6" />
                  <span>{t("quality-moderation-excluded")}</span>
                </div>
              ) : isGeneric404 ? (
                <div className="flex gap-1">
                  <TriangleAlertIcon className="text-2xl size-6" />
                  <span className="text-flathub-red">{t("server-error")}</span>
                </div>
              ) : (
                <QualityModerationStatusComponent status={query?.data?.data} />
              )}
            </div>
          </div>
        )}
        <div className="ms-auto flex">
          {canReviewModeration && (
            <Button size="lg" variant="secondary" asChild className="me-2">
              <Link href={`/admin/moderation/${app.id}`}>
                <ScanEyeIcon className="w-5 h-5" />
                <div className="hidden sm:block">Review</div>
              </Link>
            </Button>
          )}
          {canViewQualityStatus && !isExcluded && (
            <QualityReviewButton
              app_id={app.id}
              status={query?.data?.data}
              review_requested_at={query?.data?.data?.review_requested_at}
              mode={mode}
            />
          )}
          {canManageApp && (
            <Button size="lg" variant="secondary" asChild className="me-2">
              <Link href={`/apps/manage/${app.id}`}>
                <SettingsIcon className="size-5" />
                <div className="hidden sm:block">{t("manage")}</div>
              </Link>
            </Button>
          )}
          {canViewQualityDetails && !(isExcluded || isGeneric404) && (
            <Button
              size="lg"
              onClick={() => {
                setIsQualityModalOpen(true)
              }}
            >
              {mode === "qualityModerator" && (
                <>
                  <ClipboardCheckIcon className="size-5" />
                  <div className="sr-only sm:not-sr-only">Moderate</div>
                </>
              )}
              {mode === "readOnly" && (
                <>
                  <EyeIcon className="size-5" />
                  <div className="sr-only sm:not-sr-only">
                    {t("quality-guideline.details")}
                  </div>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {canViewQualityDetails && (
        <QualityModerationSlideOver
          mode={mode}
          app={app}
          isQualityModalOpen={isQualityModalOpen}
          setIsQualityModalOpen={setIsQualityModalOpen}
        />
      )}
    </>
  )
}
