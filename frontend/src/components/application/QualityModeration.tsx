import { useEffect, useState } from "react"
import { useUserContext } from "src/context/user-info"
import Button from "../Button"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import { useMutation, useQuery } from "@tanstack/react-query"
import Spinner from "../Spinner"
import clsx from "clsx"
import {
  HiCheckCircle,
  HiExclamationTriangle,
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
  if (!status) {
    return null
  }

  if (status.passes) {
    return (
      <div className="flex gap-1">
        <HiCheckCircle className="text-2xl" />
        <span>High quality app data</span>
      </div>
    )
  } else if (status.not_passed === 0) {
    return (
      <div className="flex gap-1">
        <HiQuestionMarkCircle className="text-2xl" />
        <span>App data review pending</span>
      </div>
    )
  } else {
    return (
      <div className="flex gap-1">
        <HiExclamationTriangle className="text-2xl" />
        <span>Failing {status.not_passed} checks</span>
      </div>
    )
  }
}

const ReviewButton = ({
  review_requested_at,
  status,
  app_id,
  buttonClicked,
}: {
  review_requested_at?: string
  status?: QualityModerationStatus
  app_id: string
  buttonClicked?: () => void
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

  if (!review_requested_at) {
    return (
      <Button
        className="mr-2"
        variant="secondary"
        onClick={() => {
          requestReviewMutation.mutate()
        }}
      >
        {t("quality-guideline.request-review")}
      </Button>
    )
  }

  return (
    <Button className="mr-2" variant="secondary" disabled>
      {t("quality-guideline.review-requested")}
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
  const user = useUserContext()
  const [isQualityModerator, setIsQualityModerator] = useState(false)

  const query = useQuery({
    queryKey: ["/quality-moderation-app-status", { appId }],
    queryFn: () =>
      qualityModerationApi.getQualityModerationStatusForAppQualityModerationAppIdStatusGet(
        appId,
      ),
    enabled: isQualityModerator,
  })

  useEffect(() => {
    if (user.info?.["is-quality-moderator"]) {
      setIsQualityModerator(true)
    }
  }, [user.info])

  if (!isQualityModerator && query.isLoading) {
    return null
  }

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
            {query.isLoading ? (
              <Spinner size={"s"} orientation="row" />
            ) : (
              <QualityModerationStatusComponent status={query?.data?.data} />
            )}
          </div>
        </div>
        <div className="ms-auto">
          <ReviewButton
            app_id={appId}
            status={query?.data?.data}
            review_requested_at={query?.data?.data?.review_requested_at}
            buttonClicked={() => {
              query.refetch()
            }}
          />
          <Button
            onClick={() => {
              setIsQualityModalOpen(true)
            }}
          >
            Manage
          </Button>
        </div>
      </div>

      <QualityModerationSlideOver
        appId={appId}
        appIcon={appIcon}
        isQualityModalOpen={isQualityModalOpen}
        setIsQualityModalOpen={setIsQualityModalOpen}
      />
    </>
  )
}
