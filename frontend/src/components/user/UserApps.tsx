import { useTranslations } from "next-intl"
import { FunctionComponent, useEffect, useState, type JSX } from "react"
import { getAppsInfo } from "../../asyncs/app"
import { useUserContext, useUserDispatch } from "../../context/user-info"
import ApplicationCollectionSuspense from "../application/ApplicationCollectionSuspense"
import Spinner from "../Spinner"
import { useMutation, useQuery } from "@tanstack/react-query"
import Pagination from "../Pagination"
import { doRefreshDevFlatpaksAuthRefreshDevFlatpaksPost } from "src/codegen"

interface Props {
  variant: "dev" | "owned" | "invited"
  customButtons?: JSX.Element
  locale: string
}

const UserApps: FunctionComponent<Props> = ({
  variant,
  customButtons,
  locale,
}) => {
  const t = useTranslations()
  const user = useUserContext()
  const userDispatch = useUserDispatch()

  const pageSize = 30

  const [page, setPage] = useState(1)

  const queryDevApplications = useQuery({
    queryKey: [`${variant}-apps`, page, pageSize, locale],
    queryFn: async () => {
      const flatpaks = user.info?.[`${variant}_flatpaks`] || []
      return getAppsInfo(
        flatpaks.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize),
        locale,
      )
    },
    enabled: !!user.info,
    placeholderData: (previousData, previousQuery) => previousData,
  })

  const queryRefreshDev = useMutation({
    mutationKey: ["refresh-dev-flatpaks"],
    mutationFn: async () =>
      doRefreshDevFlatpaksAuthRefreshDevFlatpaksPost({
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

  if (user.loading || !user.info) {
    return null
  }

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
      ? (appId: string) => `/apps/manage/${appId}/accept-invite`
      : (appId: string) => `/apps/manage/${appId}`

  const pages = Array.from(
    {
      length: Math.ceil(
        (user.info?.[`${variant}_flatpaks`]?.length || 0) / pageSize,
      ),
    },
    (_, i) => i + 1,
  )

  return (
    <>
      <ApplicationCollectionSuspense
        title={title}
        applications={queryDevApplications.data}
        customButtons={customButtons}
        onRefresh={variant === "dev" && queryRefreshDev.mutate}
        variant="nested"
        showId
        showRuntime
        link={link}
      />
      <Pagination currentPage={page} pages={pages} onClick={setPage} />
    </>
  )
}

export default UserApps
