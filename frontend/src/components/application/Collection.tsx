import { FunctionComponent, type JSX } from "react"

import { Appstream, AppstreamListItem } from "../../types/Appstream"

import { useTranslations } from "next-intl"
import Pagination from "../Pagination"
import { ApplicationCard } from "./ApplicationCard"
import { Button } from "@/components/ui/button"
import { useRouter } from "src/i18n/navigation"
import { useSearchParams } from "next/navigation"

interface Props {
  applications: Appstream[] | AppstreamListItem[]
  title?: string
  page?: number
  totalPages?: number
  totalHits?: number
  onRefresh?: () => void
  link?: (appid: string) => string
  variant?: "default" | "nested" | "flat"
  showId?: boolean
  customButtons?: JSX.Element
}

const Header = ({
  title,
  refresh,
  totalHits,
  customButtons,
}: {
  title?: string
  refresh: JSX.Element | null
  totalHits?: number
  customButtons?: JSX.Element
}) => {
  const t = useTranslations()

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
  page,
  totalPages,
  totalHits,
  onRefresh,
  link,
  variant = "default",
  showId = false,
  customButtons,
}) => {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()

  const refresh = onRefresh ? (
    <Button
      size="lg"
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
    page = parseInt((searchParams.get("page") ?? "1") as string)
  }
  const pages = Array.from({ length: totalPages ?? 1 }, (_, i) => i + 1)

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
          <div key={app.id} className="flex flex-col gap-2">
            <ApplicationCard
              application={app}
              link={link}
              variant={variant}
              showId={showId}
            />
          </div>
        ))}
      </div>

      {totalPages && <Pagination pages={pages} currentPage={page ?? 1} />}
    </section>
  )
}

export default ApplicationCollection
