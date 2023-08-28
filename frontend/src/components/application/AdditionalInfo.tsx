import { Appstream } from "../../types/Appstream"
import { Summary } from "../../types/Summary"
import ListBox from "./ListBox"
import {
  HiChatBubbleLeftRight,
  HiCloudArrowDown,
  HiCodeBracket,
  HiCodeBracketSquare,
  HiFlag,
  HiFolderArrowDown,
  HiGlobeAlt,
  HiInbox,
  HiLanguage,
  HiLifebuoy,
  HiWrenchScrewdriver,
} from "react-icons/hi2"
import { BsHddFill, BsLaptop } from "react-icons/bs"
import { AppStats } from "../../types/AppStats"
import { i18n, useTranslation } from "next-i18next"
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

  return (
    <div className="relative flex flex-wrap gap-2">
      <ListBox
        inACard
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
        inACard
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
      <ListBox
        inACard
        appId={appId}
        items={[
          {
            icon: <BsLaptop />,
            header: t("available-architectures"),
            content: {
              type: "text",
              text:
                summary && summary.arches && summary.arches.length > 0
                  ? summary.arches.join(", ")
                  : t("unknown"),
            },
          },
        ]}
      ></ListBox>
      {stats.installs_total !== 0 && (
        <ListBox
          inACard
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
      )}
      {data.urls?.homepage && (
        <ListBox
          inACard
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
          inACard
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
          inACard
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
          inACard
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
          inACard
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
          inACard
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
          inACard
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
          inACard
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
        inACard
        appId={appId}
        items={[
          {
            icon: <HiCodeBracketSquare />,
            header: t("manifest"),
            content: {
              type: "url",
              text:
                data.metadata?.["flathub::manifest"] ??
                `https://github.com/flathub/${appId}`,
              trackAsEvent: "Manifest",
            },
          },
        ]}
      ></ListBox>
    </div>
  )
}

export default AdditionalInfo
