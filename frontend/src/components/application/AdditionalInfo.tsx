import { Appstream } from "../../types/Appstream"
import { Summary } from "../../types/Summary"
import ListBox from "./ListBox"
import {
  HiChatBubbleLeftRight,
  HiCloudArrowDown,
  HiCodeBracket,
  HiFlag,
  HiFolderArrowDown,
  HiGlobeAlt,
  HiInbox,
  HiLanguage,
  HiLifebuoy,
  HiScale,
  HiWrenchScrewdriver,
} from "react-icons/hi2"
import { BsHddFill, BsLaptop } from "react-icons/bs"
import { AppStats } from "../../types/AppStats"
import spdxLicenseList from "spdx-license-list/full"
import { i18n, useTranslation } from "next-i18next"
import { TFunction } from "react-i18next"
import { calculateHumanReadableSize } from "../../size"
import { getIntlLocale } from "../../localize"

const AdditionalInfo = ({
  data,
  summary,
  appId,
  stats,
}: {
  data: Appstream
  summary?: Summary
  appId: string
  stats: AppStats
}) => {
  const { t } = useTranslation()
  const license = getLicense(data.project_license, t)

  const licenseIsLink = data.project_license?.startsWith(
    "LicenseRef-proprietary=",
  )

  return (
    <div className="relative flex flex-wrap gap-2">
      <ListBox
        appId={appId}
        items={[
          {
            icon: <BsHddFill />,
            header: t("installed-size"),
            content: {
              type: "text",
              text: summary
                ? `~${calculateHumanReadableSize(summary.installed_size)}`
                : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      <ListBox
        appId={appId}
        items={[
          {
            icon: <HiFolderArrowDown />,
            header: t("download-size"),
            content: {
              type: "text",
              text: summary
                ? calculateHumanReadableSize(summary.download_size)
                : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      {/* {data.content_rating} */}
      {summary.arches.length > 0 && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <BsLaptop />,
              header: t("available-architectures"),
              content: {
                type: "text",
                text: summary ? summary.arches.join(", ") : t("unknown"),
              },
            },
          ]}
        ></ListBox>
      )}
      <ListBox
        appId={appId}
        items={[
          {
            icon: <HiCloudArrowDown />,
            header: t("installs"),
            content: {
              type: "text",
              text: stats.installs_total.toLocaleString(
                getIntlLocale(i18n.language),
              ),
            },
          },
        ]}
      ></ListBox>
      {license && (
        <ListBox
          appId={appId}
          items={[
            {
              icon: <HiScale />,
              header: t("license"),
              content: {
                type: licenseIsLink ? "url" : "text",
                text: license,
                trackAsEvent: "License",
              },
            },
          ]}
        ></ListBox>
      )}
      {data.urls?.homepage && (
        <ListBox
          appId={appId}
          items={[
            data.urls.homepage
              ? {
                  content: {
                    type: "url",
                    text: data.urls.homepage,
                    trackAsEvent: "Homepage",
                  },
                  icon: <HiGlobeAlt />,
                  header: t("project-website"),
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.contact && (
        <ListBox
          appId={appId}
          items={[
            data.urls.contact
              ? {
                  content: {
                    type: "url",
                    text: data.urls.contact,
                    trackAsEvent: "Contact",
                  },
                  icon: <HiInbox />,
                  header: t("contact"),
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.help && (
        <ListBox
          appId={appId}
          items={[
            data.urls.help
              ? {
                  content: {
                    type: "url",
                    text: data.urls.help,
                    trackAsEvent: "Help",
                  },
                  icon: <HiLifebuoy />,
                  header: t("help"),
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.faq && (
        <ListBox
          appId={appId}
          items={[
            data.urls.faq
              ? {
                  content: {
                    type: "url",
                    text: data.urls.faq,
                    trackAsEvent: "Faq",
                  },
                  icon: <HiChatBubbleLeftRight />,
                  header: t("frequently-asked-questions"),
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.translate && (
        <ListBox
          appId={appId}
          items={[
            data.urls.translate
              ? {
                  icon: <HiLanguage />,
                  header: t("contribute-translations"),
                  content: {
                    type: "url",
                    text: data.urls.translate,
                    trackAsEvent: "Translate",
                  },
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.bugtracker && (
        <ListBox
          appId={appId}
          items={[
            data.urls.bugtracker
              ? {
                  icon: <HiFlag />,
                  header: t("report-an-issue"),
                  content: {
                    type: "url",
                    text: data.urls.bugtracker,
                    trackAsEvent: "Bugtracker",
                  },
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.vcs_browser && (
        <ListBox
          appId={appId}
          items={[
            data.urls.vcs_browser
              ? {
                  icon: <HiCodeBracket />,
                  header: t("vcs_browser"),
                  content: {
                    type: "url",
                    text: data.urls.vcs_browser,
                    trackAsEvent: "VCS_Browser",
                  },
                }
              : undefined,
          ]}
        />
      )}
      {data.urls?.contribute && (
        <ListBox
          appId={appId}
          items={[
            data.urls.contribute
              ? {
                  icon: <HiWrenchScrewdriver />,
                  header: t("contribute"),
                  content: {
                    type: "url",
                    text: data.urls.contribute,
                    trackAsEvent: "Contribute",
                  },
                }
              : undefined,
          ]}
        />
      )}
      <ListBox
        appId={appId}
        items={[
          {
            icon: <HiCloudArrowDown />,
            header: t("manifest"),
            content: {
              type: "url",
              text:
                data.metadata?.["Flathub::manifest"] ??
                `https://github.com/flathub/${appId}`,
              trackAsEvent: "Manifest",
            },
          },
        ]}
      ></ListBox>
    </div>
  )
}

function getLicense(
  project_license: string | undefined,
  t: TFunction<"translation", undefined>,
): string | undefined {
  if (!project_license) {
    return undefined
  }

  if (project_license?.startsWith("LicenseRef-proprietary=")) {
    return project_license?.replace(/LicenseRef-proprietary=/, "")
  }
  if (project_license?.startsWith("LicenseRef-proprietary")) {
    return t("proprietary")
  }

  const splitLicense = project_license.split(" ")
  if (splitLicense.length <= 1) {
    return (
      spdxLicenseList[project_license]?.name ?? project_license ?? t("unknown")
    )
  }

  return splitLicense
    .map((license) => {
      if (spdxLicenseList[license]) {
        return spdxLicenseList[license].name
      }
    })
    .join(", ")
}

export default AdditionalInfo
