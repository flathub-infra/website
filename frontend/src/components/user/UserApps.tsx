import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect } from "react"
import { getAppsInfo, refreshDevFlatpaks } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"
import { useQuery } from "@tanstack/react-query"

interface Props {
  variant: "dev" | "owned" | "invited"
  customButtons?: JSX.Element
}

const UserApps: FunctionComponent<Props> = ({ variant, customButtons }) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  const queryDevApplications = useQuery({
    queryKey: [`${variant}-apps`],
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

  const title = t(
    { dev: "authored-apps", owned: "owned-apps", invited: "invited-apps" }[
      variant
    ],
  )

  const link =
    variant === "invited"
      ? (app_id: string) => `/apps/manage/${app_id}/accept-invite`
      : undefined

  return (
    <ApplicationCollection
      user={user}
      title={title}
      applications={queryDevApplications.data}
      customButtons={customButtons}
      onRefresh={variant === "dev" && queryRefreshDev.refetch}
      inACard
      showId
      link={link}
    />
  )
}

export default UserApps
