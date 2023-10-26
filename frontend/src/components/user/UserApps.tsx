import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo, refreshDevFlatpaks } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"
import { useQuery } from "@tanstack/react-query"
import Pagination from "../Pagination"

interface Props {
  variant: "dev" | "owned" | "invited"
  customButtons?: JSX.Element
}

const UserApps: FunctionComponent<Props> = ({ variant, customButtons }) => {
  const { t } = useTranslation()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  const pageSize = 30

  const [page, setPage] = useState(1)

  const queryDevApplications = useQuery({
    queryKey: [`${variant}-apps`, page],
    queryFn: async () => {
      return getAppsInfo(
        user.info[`${variant}-flatpaks`].slice(
          page * pageSize,
          (page + 1) * pageSize,
        ),
      )
    },
    enabled: !!user.info,
    placeholderData: (previousData, previousQuery) => previousData,
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

  const pages = Array.from(
    { length: Math.ceil(user.info[`${variant}-flatpaks`].length / pageSize) },
    (_, i) => i + 1,
  )

  return (
    <>
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
      <Pagination currentPage={page} pages={pages} onClick={setPage} />
    </>
  )
}

export default UserApps
