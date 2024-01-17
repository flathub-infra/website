import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { getAppsInfo } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import ApplicationCollection from "../application/Collection"
import Spinner from "../Spinner"
import { useMutation, useQuery } from "@tanstack/react-query"
import Pagination from "../Pagination"
import { authApi } from "src/api"

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

  const [offset, setOffset] = useState((page - 1) * pageSize)

  useEffect(() => {
    setOffset((page - 1) * pageSize)
  }, [page])

  const queryDevApplications = useQuery({
    queryKey: [`${variant}-apps`, page],
    queryFn: async () => {
      return getAppsInfo(
        user.info[`${variant}_flatpaks`].slice(offset, offset + pageSize),
      )
    },
    enabled: !!user.info,
    placeholderData: (previousData, previousQuery) => previousData,
  })

  const queryRefreshDev = useMutation({
    mutationKey: ["refresh-dev-flatpaks"],
    mutationFn: async () =>
      authApi.doRefreshDevFlatpaksAuthRefreshDevFlatpaksPost({
        withCredentials: true,
      }),
  })

  useEffect(() => {
    if (queryRefreshDev.data) {
      userDispatch({
        type: "update-dev-flatpaks",
        devFlatpaks: queryRefreshDev.data.data.dev_flatpaks,
      })
    }
  }, [queryRefreshDev.data, userDispatch])

  if (queryDevApplications.isPending || queryRefreshDev.isPending) {
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
    {
      length: Math.ceil(user.info[`${variant}_flatpaks`].length / pageSize),
    },
    (_, i) => i + 1,
  )

  return (
    <>
      <ApplicationCollection
        user={user}
        title={title}
        applications={queryDevApplications.data}
        customButtons={customButtons}
        onRefresh={variant === "dev" && queryRefreshDev.mutate}
        inACard
        showId
        link={link}
      />
      <Pagination currentPage={page} pages={pages} onClick={setPage} />
    </>
  )
}

export default UserApps
