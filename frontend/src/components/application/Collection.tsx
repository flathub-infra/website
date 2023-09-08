import { useRouter } from "next/router"
import { FunctionComponent } from "react"

import { Appstream, AppstreamListItem } from "../../types/Appstream"

import { useTranslation } from "next-i18next"
import { UserState } from "src/types/Login"
import Button from "../Button"
import ButtonLink from "../ButtonLink"
import Pagination from "../Pagination"
import ApplicationCard from "./ApplicationCard"
import { motion } from "framer-motion"

interface Props {
  applications: Appstream[] | AppstreamListItem[]
  title: string
  user?: UserState
  page?: number
  totalPages?: number
  totalHits?: number
  onRefresh?: () => void
  link?: (appid: string) => string
  inACard?: boolean
  showId?: boolean
  customButtons?: JSX.Element
}

const Header = ({
  title,
  refresh,
  totalHits,
  customButtons,
}: {
  title: string
  refresh?: JSX.Element
  totalHits?: number
  customButtons?: JSX.Element
}) => {
  const { t } = useTranslation()

  return (
    <span className="gap-2 flex sm:flex-row flex-col sm:items-center justify-between pb-2">
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
      <div className="flex gap-2">
        {customButtons}
        {refresh}
      </div>
    </span>
  )
}

// If you don't set a totalPages, we assume you donq't want pagination
// So you likely want to pass all your applications at once
const ApplicationCollection: FunctionComponent<Props> = ({
  applications,
  title,
  user,
  page,
  totalPages,
  totalHits,
  onRefresh,
  link,
  inACard,
  showId = false,
  customButtons,
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  const refresh = onRefresh ? (
    <Button
      className="w-full sm:w-auto"
      variant="secondary"
      onClick={onRefresh}
    >
      {t("refresh")}
    </Button>
  ) : null

  if (applications.length === 0) {
    return (
      <div className="flex">
        <section className="w-full">
          <div className="w-full">
            <Header
              title={title}
              refresh={refresh}
              customButtons={customButtons}
            />
            <p>{t("no-apps")}</p>
          </div>
        </section>
      </div>
    )
  }

  if (!page && totalPages) {
    page = parseInt((router.query.page ?? "1") as string)
  }
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <section className="flex flex-col gap-3">
      <Header
        title={title}
        totalHits={totalHits}
        refresh={refresh}
        customButtons={customButtons}
      />

      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {applications.map((app) => (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            key={app.id}
            className={"flex flex-col gap-2"}
          >
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
          </motion.div>
        ))}
      </div>

      {totalPages && <Pagination pages={pages} currentPage={page} />}
    </section>
  )
}

export default ApplicationCollection
