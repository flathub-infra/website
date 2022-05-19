import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useEffect } from "react"
import { getAppsInfo } from "../../asyncs/app"
import { useUserContext } from "../../context/user-info"
import { useAsync } from "../../hooks/useAsync"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"

const UserApps: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()

  const getApps = useCallback(
    () => getAppsInfo(user.info["dev-flatpaks"]),
    [user.info],
  )
  const { execute, status, value: apps } = useAsync(getApps, false)

  // User app list not available until login context resolves
  useEffect(() => {
    if (user.info) execute()
  }, [user.info, execute])

  if (["idle", "pending"].includes(status)) {
    return <Spinner size="m" text={t("loading-user-apps")} />
  }

  return <ApplicationCollection title={t("your-apps")} applications={apps} />
}

export default UserApps
