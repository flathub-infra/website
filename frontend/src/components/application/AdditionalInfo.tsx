import { Appstream } from "../../types/Appstream"
import { Summary } from "../../types/Summary"
import ListBox from "./ListBox"
import styles from "./AdditionalInfo.module.scss"
import {
  MdCloudDownload,
  MdContactPage,
  MdDownload,
  MdHelp,
  MdOutlineBugReport,
  MdQuestionAnswer,
  MdTranslate,
  MdWeb,
} from "react-icons/md"
import { BsHddFill, BsTextParagraph } from "react-icons/bs"
import { MdLaptop } from "react-icons/md"
import { AppStats } from "../../types/AppStats"
import spdxLicenseList from "spdx-license-list/full"
import { i18n, useTranslation } from "next-i18next"
import { TFunction } from "react-i18next"
import { calculateHumanReadableSize } from "../../size"

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
    <div className={styles.additionalInfo}>
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
            icon: <MdDownload />,
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
      <ListBox
        appId={appId}
        items={[
          {
            icon: <MdLaptop />,
            header: t("available-architectures"),
            content: {
              type: "text",
              text: summary ? summary.arches.join(", ") : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      <ListBox
        appId={appId}
        items={[
          {
            icon: <MdCloudDownload />,
            header: t("downloads"),
            content: {
              type: "text",
              text: stats.downloads_total.toLocaleString(
                i18n.language.substring(0, 2),
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
              icon: <BsTextParagraph />,
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
                  icon: <MdWeb />,
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
                  icon: <MdContactPage />,
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
                  icon: <MdHelp />,
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
                  icon: <MdQuestionAnswer />,
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
                  icon: <MdTranslate />,
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
                  icon: <MdOutlineBugReport />,
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
      <ListBox
        appId={appId}
        items={[
          {
            icon: <MdCloudDownload />,
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
