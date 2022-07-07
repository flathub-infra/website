import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect } from "react"
import { getAppsInfo } from "../../asyncs/app"
import { useUserContext } from "../../context/user-info"
import { useAsync } from "../../hooks/useAsync"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"

interface Props {
  variant: "dev" | "owned"
}

const UserApps: FunctionComponent<Props> = ({ variant }) => {
  const { t } = useTranslation()
  const user = useUserContext()

  const getApps = useCallback(
    () => getAppsInfo(user.info[`${variant}-flatpaks`]),
    [user.info, variant],
  )
  const { execute, status, value: apps } = useAsync(getApps, false)

  // User app list not available until login context resolves
  useEffect(() => {
    if (user.info) execute()
  }, [user.info, execute])

  if (["idle", "pending"].includes(status)) {
    return <Spinner size="m" text={t("loading-user-apps")} />
  }

  const title = t(variant === "dev" ? "your-apps" : "owned-apps")

  if (apps.length === 0) {
    return (
      <>
        <h2>{title}</h2>
        <p>{t("no-applications")}</p>
      </>
    )
  }

  return <ApplicationCollection title={title} applications={apps} />
}

export default UserApps
