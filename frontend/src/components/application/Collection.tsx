import { FunctionComponent } from "react"
import { useRouter } from "next/router"

import { Appstream } from "../../types/Appstream"

import ApplicationCard from "./ApplicationCard"
import Pagination from "../Pagination"
import { useTranslation } from "next-i18next"

interface Props {
  applications: Appstream[]
  perPage?: number
  title: string
}

const ApplicationCollection: FunctionComponent<Props> = ({
  applications,
  title,
  perPage = 30,
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const page = parseInt((router.query.page ?? "1") as string)
  const totalPages = Math.ceil(applications.length / perPage)
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const pagedApplications = applications.slice(
    (page - 1) * perPage,
    page * perPage,
  )

  return (
    <div className="main-container">
      <div className="flex">
        <section className="min-h-[750px] w-full">
          <div className="w-full">
            <h2>{title}</h2>
            <p>{t("number-of-results", { number: applications.length })}</p>

            <div className="grid grid-cols-2 justify-around gap-4 lg:grid-cols-3 2xl:grid-cols-6">
              {pagedApplications.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>

            <Pagination pages={pages} currentPage={page} />
          </div>
        </section>
      </div>
    </div>
  )
}

export default ApplicationCollection
