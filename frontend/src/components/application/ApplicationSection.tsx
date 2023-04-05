import { FunctionComponent } from "react"

import { AppstreamListItem } from "../../types/Appstream"

import ApplicationCard from "./ApplicationCard"
import { useTranslation } from "next-i18next"
import ButtonLink from "../ButtonLink"

interface Props {
  href: string
  title: string
  applications: AppstreamListItem[]
  showMore?: boolean
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
  showMore = true,
}) => {
  const { t } = useTranslation()

  if (!applications || !applications.length) return null

  return (
    <div>
      <header className="mb-3 mt-10 flex max-w-full flex-row content-center justify-between">
        <h2 className="my-auto">{title}</h2>

        {showMore && (
          <ButtonLink
            href={href}
            passHref
            aria-label={t("more-type", { type: title })}
          >
            {t("more")}
          </ButtonLink>
        )}
      </header>
      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {applications.map((app) => (
          <ApplicationCard key={app.id} application={app} />
        ))}
      </div>
    </div>
  )
}

export default ApplicationSection
