import { useEffect, useState } from "react"
import { useUserContext } from "src/context/user-info"
import Button from "../Button"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import { useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import {
  HiCheckCircle,
  HiCog6Tooth,
  HiEnvelope,
  HiEnvelopeOpen,
  HiExclamationTriangle,
  HiEye,
  HiQuestionMarkCircle,
} from "react-icons/hi2"
import { qualityModerationApi } from "src/api"
import { QualityModerationStatus } from "src/codegen"
import { useTranslation } from "next-i18next"

const QualityModerationStatusComponent = ({
  status,
}: {
  status: undefined | QualityModerationStatus
}) => {
  const { t } = useTranslation()

  if (!status) {
    return null
  }

  if (status.passes) {
    return (
      <div className="flex gap-1">
        <HiCheckCircle className="text-2xl" />
        <span>{t("quality-guideline.high-quality-app-data")}</span>
      </div>
    )
  } else if (status.not_passed === 0) {
    return (
      <div className="flex gap-1">
        <HiQuestionMarkCircle className="text-2xl" />
        <span>{t("quality-guideline.app-data-review-pending")}</span>
      </div>
    )
  } else {
    return (
      <div className="flex gap-1">
        <HiExclamationTriangle className="text-2xl" />
        <span>
          {t("quality-guideline.failing-x-checks", {
            count: status.not_passed,
          })}
        </span>
      </div>
    )
  }
}

const ReviewButton = ({
  review_requested_at,
  status,
  app_id,
  buttonClicked,
  mode,
}: {
  review_requested_at?: string
  status?: QualityModerationStatus
  app_id: string
  buttonClicked?: () => void
  mode?: "moderator" | "developer"
}) => {
  const { t } = useTranslation()

  const requestReviewMutation = useMutation({
    mutationFn: () =>
      qualityModerationApi.requestReviewForAppQualityModerationAppIdRequestReviewPost(
        app_id,
        {
          withCredentials: true,
        },
      ),
    onSuccess: () => {
      buttonClicked?.()
    },
  })

  if (status?.passes) {
    return null
  }

  if (mode === "moderator" && !review_requested_at) {
    return null
  }

  if (!review_requested_at) {
    return (
      <Button
        className="mr-2 flex items-center gap-1"
        variant="secondary"
        onClick={() => {
          requestReviewMutation.mutate()
        }}
      >
        <HiEnvelopeOpen className="w-5 h-5" />
        <div className="hidden sm:block">
          {t("quality-guideline.request-review")}
        </div>
      </Button>
    )
  }

  return (
    <Button
      className="mr-2 flex items-center gap-1"
      variant="secondary"
      disabled
    >
      <HiEnvelope className="w-5 h-5" />
      <div className="hidden sm:block">
        {t("quality-guideline.review-requested")}
      </div>
    </Button>
  )
}

export const QualityModeration = ({
  appId,
  appIcon,
  isQualityModalOpen,
  setIsQualityModalOpen,
}: {
  appId: string
  appIcon: string
  isQualityModalOpen: boolean
  setIsQualityModalOpen: (isOpen: boolean) => void
}) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const [isQualityModerator, setIsQualityModerator] = useState(false)

  const requirement =
    isQualityModerator || user.info?.["dev-flatpaks"].includes(appId)

  const query = useQuery({
    queryKey: ["/quality-moderation-app-status", { appId }],
    queryFn: ({ signal }) =>
      qualityModerationApi.getQualityModerationStatusForAppQualityModerationAppIdStatusGet(
        appId,
        {
          withCredentials: true,
          signal: signal,
        },
      ),
    enabled: requirement,
  })

  useEffect(() => {
    if (user.info?.["is-quality-moderator"]) {
      setIsQualityModerator(true)
    }
  }, [user.info])

  if (!requirement) {
    return null
  }

  const mode = isQualityModerator ? "moderator" : "developer"

  return (
    <>
      <div
        className={clsx(
          "flex px-8 h-16 items-center",
          query.data?.data.passes
            ? "bg-flathub-celestial-blue/40"
            : query.data?.data["not_passed"] === 0
              ? "bg-flathub-gainsborow/40"
              : "bg-flathub-electric-red/40",
        )}
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center">
            {query.isPending ? (
              <Spinner size={"s"} orientation="row" />
            ) : (
              <QualityModerationStatusComponent status={query?.data?.data} />
            )}
          </div>
        </div>
        <div className="ms-auto flex">
          <ReviewButton
            app_id={appId}
            status={query?.data?.data}
            review_requested_at={query?.data?.data?.review_requested_at}
            buttonClicked={() => {
              query.refetch()
            }}
            mode={mode}
          />
          <Button
            onClick={() => {
              setIsQualityModalOpen(true)
            }}
            className="flex items-center gap-1"
          >
            {mode === "moderator" && (
              <>
                <HiCog6Tooth className="w-5 h-5" />
                <div className="hidden sm:block">Moderate</div>
              </>
            )}
            {mode === "developer" && (
              <>
                <HiEye className="w-5 h-5" />
                <div className="hidden sm:block">
                  {t("quality-guideline.details")}
                </div>
              </>
            )}
          </Button>
        </div>
      </div>

      <QualityModerationSlideOver
        mode={mode}
        appId={appId}
        appIcon={appIcon}
        isQualityModalOpen={isQualityModalOpen}
        setIsQualityModalOpen={setIsQualityModalOpen}
      />
    </>
  )
}
