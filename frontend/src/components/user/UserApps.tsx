import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { useUserContext } from "../../context/user-info"
import { APP_DETAILS } from "../../env"
import { DesktopAppstream } from "../../types/Appstream"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"

async function getAppsInfo(
  appIds: string[],
  setLoading: (a: boolean) => void,
  setApps: (a: DesktopAppstream[]) => void,
) {
  setLoading(true)

  const responses = await Promise.all(
    appIds.map((id) => fetch(`${APP_DETAILS(id)}`)),
  )
  const apps = await Promise.all(responses.map((res) => res.json()))

  setApps(apps)
  setLoading(false)
}

const UserApps: FunctionComponent = () => {
  const { t } = useTranslation()
  const user = useUserContext()
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user.info) return

    const { "dev-flatpaks": appIds } = user.info
    getAppsInfo(appIds, setLoading, setApps)
  }, [user.info])

  // Nothing to show if not logged in
  if (!user.info) {
    return <></>
  }

  if (loading) {
    return <Spinner size={100} text={t("loading-user-apps")} />
  }

  return <ApplicationCollection title={t("your-apps")} applications={apps} />
}

export default UserApps
