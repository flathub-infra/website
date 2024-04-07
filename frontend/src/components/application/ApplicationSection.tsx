import { FunctionComponent, ReactElement } from "react"

import { AppstreamListItem } from "../../types/Appstream"

import ApplicationCard from "./ApplicationCard"
import { useTranslation } from "next-i18next"
import ButtonLink from "../ButtonLink"
import { motion } from "framer-motion"

interface Props {
  href: string
  title: string
  applications: AppstreamListItem[]
  appSelection?: ReactElement
  showMore?: boolean
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
  appSelection,
  showMore = true,
}) => {
  const { t } = useTranslation()

  if (!applications || !applications.length) return null

  return (
    <div>
      <header className="mb-3 flex max-w-full flex-row content-center justify-between">
        <h2 className="my-auto text-2xl font-bold">{title}</h2>

        {showMore && (
          <ButtonLink
            href={href}
            passHref
            aria-label={t("more-type", { type: title })}
            title={t("more-type", { type: title })}
          >
            {t("more")}
          </ButtonLink>
        )}
      </header>

      {appSelection && <div className="mb-3">{appSelection}</div>}

      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {applications.map((app) => (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            key={app.id}
          >
            <ApplicationCard application={app} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default ApplicationSection
