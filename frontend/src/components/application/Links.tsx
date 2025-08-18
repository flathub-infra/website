import { FunctionComponent, type JSX } from "react"

import { Appstream } from "../../types/Appstream"
import { useTranslations } from "next-intl"
import {
  HiChatBubbleLeftRight,
  HiCodeBracket,
  HiCodeBracketSquare,
  HiFlag,
  HiGlobeAlt,
  HiInbox,
  HiLanguage,
  HiLifebuoy,
  HiMiniArrowTopRightOnSquare,
  HiWrenchScrewdriver,
} from "react-icons/hi2"
import clsx from "clsx"
import React from "react"
import { useMatomo } from "@mitresthen/matomo-tracker-react"
import { ProjectUrl } from "src/types/ProjectUrl"

interface Props {
  app: Pick<Appstream, "id" | "urls"> & {
    metadata?: Pick<
      Appstream["metadata"],
      "flathub::manifest" | "flathub::verification::verified"
    >
  }
}

const Links: FunctionComponent<Props> = ({ app }) => {
  const t = useTranslations()
  const { trackEvent } = useMatomo()

  const links: {
    content: { text: string; trackAsEvent: ProjectUrl }
    icon: JSX.Element
    name: string
  }[] = []

  if (app.urls?.homepage) {
    links.push({
      content: {
        text: app.urls.homepage,
        trackAsEvent: "Homepage",
      },
      icon: <HiGlobeAlt />,
      name: t("project-website"),
    })
  }

  if (app.urls?.contact) {
    links.push({
      content: {
        text: app.urls.contact,
        trackAsEvent: "Contact",
      },
      icon: <HiInbox />,
      name: t("contact"),
    })
  }

  if (app.urls?.help) {
    links.push({
      content: {
        text: app.urls.help,
        trackAsEvent: "Help",
      },
      icon: <HiLifebuoy />,
      name: t("help"),
    })
  }

  if (app.urls?.faq) {
    links.push({
      content: {
        text: app.urls.faq,
        trackAsEvent: "Faq",
      },
      icon: <HiChatBubbleLeftRight />,
      name: t("frequently-asked-questions"),
    })
  }

  if (app.urls?.translate) {
    links.push({
      content: {
        text: app.urls.translate,
        trackAsEvent: "Translate",
      },
      icon: <HiLanguage />,
      name: t("contribute-translations"),
    })
  }

  links.push({
    content: {
      text:
        app.metadata?.["flathub::verification::verified"] &&
        app.urls?.bugtracker
          ? app.urls.bugtracker
          : `https://github.com/flathub/${app.id}/issues`,
      trackAsEvent: "Bugtracker",
    },
    icon: <HiFlag />,
    name: t("report-an-issue"),
  })

  if (app.urls?.vcs_browser) {
    links.push({
      content: {
        text: app.urls.vcs_browser,
        trackAsEvent: "VCS_Browser",
      },
      icon: <HiCodeBracket />,
      name: t("vcs_browser"),
    })
  }

  if (app.urls?.contribute) {
    links.push({
      content: {
        text: app.urls.contribute,
        trackAsEvent: "Contribute",
      },
      icon: <HiWrenchScrewdriver />,
      name: t("contribute"),
    })
  }

  links.push({
    content: {
      text:
        app.metadata?.["flathub::manifest"] ??
        `https://github.com/flathub/${app.id}`,
      trackAsEvent: "Manifest",
    },
    icon: <HiCodeBracketSquare />,
    name: t("manifest"),
  })

  return (
    <>
      {links && links.length > 0 && (
        <>
          <div className="flex flex-col divide-y dark:divide-flathub-granite-gray">
            {links.map((link) => {
              const linkClicked = () => {
                trackEvent({
                  category: "App",
                  action: link.content.trackAsEvent,
                  name: app.id,
                })
              }

              return (
                <a
                  href={link.content.text}
                  target="_blank"
                  rel="noreferrer"
                  onClick={linkClicked}
                  title={t("open-in-new-tab")}
                  className={clsx(
                    "px-4",
                    "text-flathub-dark-gunmetal dark:text-flathub-gainsborow flex items-center text-start",
                    "hover:bg-flathub-gainsborow/20 active:bg-flathub-gainsborow/50 dark:hover:bg-flathub-gainsborow/20 dark:active:bg-flathub-gainsborow/30 transition",
                    "last:rounded-b-xl",
                  )}
                  key={link.name}
                >
                  {React.createElement(
                    link.icon.type,
                    {
                      className: clsx(
                        "shrink-0 w-6 h-6 text-flathub-granite-gray dark:text-flathub-spanish-gray",
                      ),
                    },
                    null,
                  )}
                  <div className="flex flex-col px-4 py-3 break-all">
                    <div>
                      <span className="font-medium">{link.name}</span>
                    </div>
                    <span
                      className={clsx(
                        "text-sm dark:text-flathub-spanish-gray leading-none text-flathub-granite-gray",
                      )}
                    >
                      {link.content.text}
                    </span>
                  </div>
                  <HiMiniArrowTopRightOnSquare className="rtl:-rotate-90 shrink-0 w-5 h-5 ms-auto text-flathub-granite-gray dark:text-flathub-spanish-gray" />
                </a>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

export default Links
