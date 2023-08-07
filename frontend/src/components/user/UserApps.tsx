import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect } from "react"
import { getAppsInfo, refreshDevFlatpaks } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"
import { useQuery } from "@tanstack/react-query"

interface Props {
  variant: "dev" | "owned"
}

const UserApps: FunctionComponent<Props> = ({ variant }) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  const queryDevApplications = useQuery({
    queryKey: ["dev-apps"],
    queryFn: async () => {
      return getAppsInfo(user.info[`${variant}-flatpaks`])
    },
    enabled: !!user.info,
  })

  const queryRefreshDev = useQuery({
    queryKey: ["refresh-dev"],
    queryFn: async () => {
      return refreshDevFlatpaks()
    },
    enabled: false,
  })

  useEffect(() => {
    if (queryRefreshDev.data) {
      userDispatch({
        type: "update-dev-flatpaks",
        devFlatpaks: queryRefreshDev.data.data["dev-flatpaks"],
      })
    }
  }, [queryRefreshDev.data, userDispatch])

  if (
    "loading" === queryDevApplications.status ||
    queryRefreshDev.isInitialLoading
  ) {
    return <Spinner size="m" text={t("loading-user-apps")} />
  }

  const title = t(variant === "dev" ? "authored-apps" : "owned-apps")

  return (
    <ApplicationCollection
      user={user}
      title={title}
      applications={queryDevApplications.data}
      onRefresh={variant === "dev" && queryRefreshDev.refetch}
      inACard
      showId
    />
  )
}

export default UserApps
