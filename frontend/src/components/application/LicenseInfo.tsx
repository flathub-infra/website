import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { clsx } from "clsx"
import { createElement } from "react"
import spdxLicenseList from "spdx-license-list"
import { Appstream } from "src/types/Appstream"
import { IconType } from "react-icons"
import { useTranslations } from "next-intl"
import {
  ExternalLinkIcon,
  EyeOffIcon,
  HandIcon,
  HeartIcon,
  ThumbsUpIcon,
  TriangleAlertIcon,
  Users2Icon,
} from "lucide-react"

const licenseRefProprietaryRegex = /LicenseRef-proprietary=(.*)/i
const licenseRefRegex = /LicenseRef-scancode-(.*)=(.*)/i

function getLicense(
  project_license: string | undefined,
  t,
): string | undefined {
  if (!project_license) {
    return undefined
  }

  const match = project_license.match(licenseRefRegex)
  if (match) {
    return match[1]
  }

  const matchProprietary = project_license.match(licenseRefProprietaryRegex)
  if (matchProprietary) {
    return matchProprietary[1]
  }

  const splitLicense = project_license.split(/\(|\)| /)
  if (splitLicense.length <= 1) {
    return (
      spdxLicenseList[project_license]?.name ?? project_license ?? t("unknown")
    )
  }

  return splitLicense
    .reduce((names, license) => {
      if (spdxLicenseList[license]) {
        return [...names, spdxLicenseList[license].name]
      }
      return names
    }, [])
    .join(", ")
}

const IconInCircle = ({
  color,
  icon,
}: {
  color: "green" | "yellow"
  icon: IconType
}) => {
  return (
    <div
      className={clsx(
        "h-10 w-10",
        "rounded-full p-2",
        color === "green" &&
          `text-flathub-status-green bg-flathub-status-green/25 dark:bg-flathub-status-green-dark/25 dark:text-flathub-status-green-dark`,

        color === "yellow" &&
          `text-flathub-status-yellow bg-flathub-status-yellow/25 dark:bg-flathub-status-yellow-dark/25 dark:text-flathub-status-yellow-dark`,
      )}
    >
      {createElement(icon, {
        className: "w-full h-full",
      })}
    </div>
  )
}

const headlineText = (licenseType: "proprietary" | "floss" | "special") => {
  if (licenseType === "proprietary") {
    return "proprietary"
  } else if (licenseType === "floss") {
    return "community-built"
  } else {
    return "special-license"
  }
}

const LicenseDescription = ({
  licenseType,
  license,
}: {
  licenseType: "proprietary" | "floss" | "special"
  license: string
}) => {
  const t = useTranslations()

  if (licenseType === "proprietary") {
    return t("proprietary-explanation")
  }
  if (licenseType === "floss") {
    return t.rich("community-built-explanation", {
      license: license,
      bold: (chunks) => <b>{chunks}</b>,
    })
  }

  return t.rich("special-license-explanation", {
    license: license,
    bold: (chunks) => <b>{chunks}</b>,
  })
}

const LicenseLink = ({
  licenseType,
  app,
  license,
}: {
  licenseType: "proprietary" | "floss" | "special"
  app: Pick<Appstream, "id" | "project_license" | "urls">
  license: string
}) => {
  const t = useTranslations()
  const { trackEvent } = useMatomo()

  const licenseProprietaryIsLink =
    app.project_license?.match(licenseRefProprietaryRegex)?.length > 0

  const linkClicked = () => {
    trackEvent({
      category: "App",
      action: licenseProprietaryIsLink ? "License" : "Homepage",
      name: app.id ?? "unknown",
    })
  }

  if (licenseType === "special") {
    return t("you-may-or-may-not-be-able-to-contribute")
  }

  return (
    ((licenseType === "proprietary" && licenseProprietaryIsLink) ||
      (licenseType === "floss" &&
        (app.urls?.homepage || app.urls?.contribute))) && (
      <a
        className="flex gap-1 items-center"
        href={
          licenseProprietaryIsLink
            ? license
            : (app.urls?.contribute ?? app.urls?.homepage)
        }
        target="_blank"
        rel="noreferrer"
        onClick={linkClicked}
        title={t("open-in-new-tab")}
      >
        {t(licenseType === "proprietary" ? "learn-more" : "get-involved")}
        <ExternalLinkIcon className="rtl:-rotate-90 h-5" />
      </a>
    )
  )
}

const LicenseInfo = ({
  app,
}: {
  app: Pick<Appstream, "id" | "is_free_license" | "project_license" | "urls">
}) => {
  const t = useTranslations()

  let licenseType: "proprietary" | "floss" | "special" = app.is_free_license
    ? "floss"
    : "special"

  licenseType =
    !app.project_license ||
    app.project_license.startsWith("LicenseRef-proprietary")
      ? "proprietary"
      : licenseType

  const license = getLicense(app.project_license, t)

  return (
    <div className="flex flex-col gap-1 justify-center items-center text-center p-4">
      <div className="flex gap-2">
        {licenseType === "proprietary" || licenseType === "special" ? (
          <>
            <IconInCircle color="yellow" icon={HandIcon} />
            <IconInCircle color="yellow" icon={TriangleAlertIcon} />
            <IconInCircle color="yellow" icon={EyeOffIcon} />
          </>
        ) : (
          <>
            <IconInCircle color="green" icon={HeartIcon} />
            <IconInCircle color="green" icon={Users2Icon} />
            <IconInCircle color="green" icon={ThumbsUpIcon} />
          </>
        )}
      </div>
      <h1 className="text-lg font-bold">{t(headlineText(licenseType))}</h1>
      <div>
        <LicenseDescription license={license} licenseType={licenseType} />
      </div>
      <LicenseLink licenseType={licenseType} app={app} license={license} />
    </div>
  )
}

export default LicenseInfo
