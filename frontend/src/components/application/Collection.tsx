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
}) => {
  const { t } = useTranslation()
  const router = useRouter()

  const refresh = onRefresh ? (
    <Button onClick={onRefresh}>{t("refresh")}</Button>
  ) : null

  const header = (
    <span className="flex items-center justify-between">
      <h2>{title}</h2>
      {refresh}
    </span>
  )

  if (applications.length === 0) {
    return (
      <div className="flex">
        <section className="w-full">
          <div className="w-full">
            {header}
            <p>{t("no-applications")}</p>
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
    <div className="flex">
      <section className="min-h-[750px] w-full">
        <div className="w-full">
          {header}

          <p>
            {t("number-of-results", {
              number: totalHits ?? applications.length,
            })}
          </p>

          <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
            {pagedApplications.map((app) => (
              <div key={app.id} className={"flex flex-col gap-2"}>
                <ApplicationCard application={app} />
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
        </div>
      </section>
    </div>
  )
}

export default ApplicationCollection
