import { useEffect, useState } from "react"
import { useUserContext } from "src/context/user-info"
import Button from "../Button"
import { QualityModerationSlideOver } from "./QualityModerationSlideOver"

export const QualityModeration = ({ appId }: { appId: string }) => {
  const user = useUserContext()
  const [isQualityModerator, setIsQualityModerator] = useState(false)
  const [isQualityModalOpen, setIsQualityModalOpen] = useState(false)

  useEffect(() => {
    if (user.info?.["is-quality-moderator"]) {
      setIsQualityModerator(true)
    }
  }, [user.info])

  if (!isQualityModerator) {
    return null
  }

  return (
    <>
      <div className="flex px-8 py-3 bg-flathub-celestial-blue/40 h-16">
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center"></div>
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
        isQualityModalOpen={isQualityModalOpen}
        setIsQualityModalOpen={setIsQualityModalOpen}
      />
    </>
  )
}
