import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect } from "react"
import { getUserData } from "src/asyncs/login"
import { getAppsInfo, refreshDevFlatpaks } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import { useAsync } from "../../hooks/useAsync"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"

interface Props {
  variant: "dev" | "owned"
}

const UserApps: FunctionComponent<Props> = ({ variant }) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  const getApps = useCallback(
    () => getAppsInfo(user.info[`${variant}-flatpaks`]),
    [user.info, variant],
  )
  const { execute, status, value: apps } = useAsync(getApps, false)

  const doRefreshDev = useCallback(async () => {
    await refreshDevFlatpaks()
    await getUserData(userDispatch)
  }, [userDispatch])
  const { execute: executeRefreshDev } = useAsync(doRefreshDev, false)

  // User app list not available until login context resolves
  useEffect(() => {
    if (user.info) execute()
  }, [user.info, execute])

  if (["idle", "pending"].includes(status)) {
    return <Spinner size="m" text={t("loading-user-apps")} />
  }

  const title = t(variant === "dev" ? "your-apps" : "owned-apps")

  return (
    <ApplicationCollection
      user={user}
      title={title}
      applications={apps}
      onRefresh={variant === "dev" && executeRefreshDev}
    />
  )
}

export default UserApps
