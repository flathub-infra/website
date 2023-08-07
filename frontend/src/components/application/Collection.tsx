import { useRouter } from "next/router"
import { FunctionComponent } from "react"

import { Appstream, AppstreamListItem } from "../../types/Appstream"

import { useTranslation } from "next-i18next"
import { UserState } from "src/types/Login"
import Button from "../Button"
import ButtonLink from "../ButtonLink"
import Pagination from "../Pagination"
import ApplicationCard from "./ApplicationCard"

interface Props {
  applications: Appstream[] | AppstreamListItem[]
  perPage?: number
  title: string
  user?: UserState
  page?: number
  totalPages?: number
  totalHits?: number
  onRefresh?: () => void
  link?: (appid: string) => string
  inACard?: boolean
  showId?: boolean
}

const Header = ({
  title,
  refresh,
  totalHits,
}: {
  title: string
  refresh?: JSX.Element
  totalHits?: number
}) => {
  const { t } = useTranslation()

  return (
    <span className="flex items-center justify-between pb-2">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {totalHits && (
          <div className="leading-none text-sm dark:text-flathub-spanish-gray text-flathub-granite-gray">
            {t("number-of-results", {
              number: totalHits,
            })}
          </div>
        )}
      </div>
      {refresh}
    </span>
  )
}

const ApplicationCollection: FunctionComponent<Props> = ({
  applications,
  title,
  perPage = 30,
  user,
  page,
  totalPages,
  totalHits,
  onRefresh,
  link,
  inACard,
  showId = false,
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  const refresh = onRefresh ? (
    <Button onClick={onRefresh}>{t("refresh")}</Button>
  ) : null

  if (applications.length === 0) {
    return (
      <div className="flex">
        <section className="w-full">
          <div className="w-full">
            <Header refresh={refresh} title={title} />
            <p>{t("no-apps")}</p>
          </div>
        </section>
      </div>
    )
  }

  if (!page) {
    page = parseInt((router.query.page ?? "1") as string)
  }
  if (!totalPages) {
    totalPages = Math.ceil(applications.length / perPage)
  }
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const pagedApplications = totalHits
    ? applications
    : applications.slice((page - 1) * perPage, page * perPage)

  return (
    <section className="flex flex-col gap-3">
      <Header refresh={refresh} title={title} totalHits={totalHits} />

      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {pagedApplications.map((app) => (
          <div key={app.id} className={"flex flex-col gap-2"}>
            <ApplicationCard
              application={app}
              link={link}
              inACard={inACard}
              showId={showId}
            />
            {!user?.loading &&
              user?.info?.["dev-flatpaks"].includes(app.id) && (
                <ButtonLink
                  passHref
                  href={`/apps/manage/${app.id}`}
                  className="w-full"
                >
                  {t("developer-settings")}
                </ButtonLink>
              )}
          </div>
        ))}
      </div>

      <Pagination pages={pages} currentPage={page} />
    </section>
  )
}

export default ApplicationCollection
