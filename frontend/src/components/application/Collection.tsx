import { FunctionComponent } from "react"
import { useRouter } from "next/router"

import { Appstream, AppstreamListItem } from "../../types/Appstream"

import ApplicationCard from "./ApplicationCard"
import Pagination from "../Pagination"
import { useTranslation } from "next-i18next"
import ButtonLink from "../ButtonLink"
import { UserState } from "src/types/Login"

interface Props {
  applications: Appstream[] | AppstreamListItem[]
  perPage?: number
  title: string
  user?: UserState
  page?: number
  totalPages?: number
  totalHits?: number
}

const ApplicationCollection: FunctionComponent<Props> = ({
  applications,
  title,
  perPage = 30,
  user,
  page,
  totalPages,
  totalHits,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
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
          <h2>{title}</h2>
          <p>
            {t("number-of-results", {
              number: totalHits ?? applications.length,
            })}
          </p>

          <div className="grid grid-cols-1 justify-around gap-4 lg:grid-cols-3 2xl:grid-cols-3">
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
