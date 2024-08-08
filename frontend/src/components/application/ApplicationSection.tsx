import { FunctionComponent, ReactElement } from "react"

import { AppstreamListItem } from "../../types/Appstream"

import { ApplicationCard, ApplicationCardSkeleton } from "./ApplicationCard"
import ButtonLink from "../ButtonLink"
import clsx from "clsx"

interface PropsWithTitle {
  type: "withTitle"
  href: string
  title: string
  applications: AppstreamListItem[]
  showMore: boolean
  moreText: string
  numberOfApps?: number
}
interface PropsWithCustomHeader {
  type: "withCustomHeader"
  href: string
  applications: AppstreamListItem[]
  customHeader: ReactElement
  showMore: boolean
  moreText: string
  numberOfApps?: number
}

const ApplicationSection: FunctionComponent<
  PropsWithCustomHeader | PropsWithTitle
> = (prop) => {
  return (
    <div>
      {prop.type === "withTitle" && (
        <header className="mb-3 flex max-w-full flex-row content-center justify-between">
          <h2 className="my-auto text-2xl font-bold">{prop.title}</h2>
        </header>
      )}

      {prop.type === "withCustomHeader" && (
        <div className="mb-3">{prop.customHeader}</div>
      )}

      <div className="grid grid-cols-1 justify-around gap-4 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3">
        {!prop.applications &&
          prop.numberOfApps &&
          [...new Array(prop.numberOfApps)].map((a, i) => (
            <ApplicationCardSkeleton key={i} />
          ))}
        {prop.applications.map((app) => (
          <div key={app.id}>
            <ApplicationCard application={app} />
          </div>
        ))}
      </div>
      {prop.showMore && (
        <div
          key={prop.moreText}
          className={clsx("flex flex-row justify-center", "mt-5")}
        >
          <ButtonLink
            href={prop.href}
            passHref
            variant="secondary"
            className="rounded-full px-8"
            aria-label={prop.moreText}
            title={prop.moreText}
          >
            {prop.moreText}
          </ButtonLink>
        </div>
      )}
    </div>
  )
}

export default ApplicationSection
