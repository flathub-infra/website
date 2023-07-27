import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect } from "react"
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
    const devFlatpaks = await refreshDevFlatpaks()
    userDispatch({ type: "update-dev-flatpaks", devFlatpaks })
  }, [userDispatch])
  const { execute: executeRefreshDev, status: refreshStatus } = useAsync(
    doRefreshDev,
    false,
  )

  // User app list not available until login context resolves
  useEffect(() => {
    if (user.info) execute()
  }, [user.info, execute])

  if (["idle", "pending"].includes(status) || refreshStatus === "pending") {
    return <Spinner size="m" text={t("loading-user-apps")} />
  }

  const title = t(variant === "dev" ? "authored-apps" : "owned-apps")

  return (
    <ApplicationCollection
      user={user}
      title={title}
      applications={apps}
      onRefresh={variant === "dev" && executeRefreshDev}
      inACard
    />
  )
}

export default UserApps
