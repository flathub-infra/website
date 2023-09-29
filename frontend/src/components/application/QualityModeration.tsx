import { useEffect, useState } from "react"
import { useUserContext } from "src/context/user-info"
import Button from "../Button"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"
import { useQuery } from "@tanstack/react-query"
import { fetchQualityModerationStatusForApp } from "src/fetchers"
import Spinner from "../Spinner"
import clsx from "clsx"
import { QualityModerationStatus } from "src/types/QualityModeration"
import {
  HiCheckCircle,
  HiExclamationTriangle,
  HiQuestionMarkCircle,
} from "react-icons/hi2"

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
  } else if (status["not-passed"] === 0) {
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
        <span>Failing {status["not-passed"]} checks</span>
      </div>
    )
  }
}

export const QualityModeration = ({
  appId,
  appIcon,
}: {
  appId: string
  appIcon: string
}) => {
  const user = useUserContext()
  const [isQualityModerator, setIsQualityModerator] = useState(false)
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false)

  const query = useQuery({
    queryKey: ["/quality-moderation-app-status", { appId }],
    queryFn: () => fetchQualityModerationStatusForApp(appId),
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
          "flex px-8 py-3 h-16",
          query.data?.data.passes
            ? "bg-flathub-celestial-blue/40"
            : query.data?.data["not-passed"] === 0
            ? "bg-flathub-gainsborow/40"
            : "bg-flathub-electric-red/40",
        )}
      >
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center">
            {query.isLoading ? (
              <Spinner size={"s"} />
            ) : (
              <QualityModerationStatusComponent status={query?.data?.data} />
            )}
          </div>
        </div>
        <div className="ms-auto">
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
