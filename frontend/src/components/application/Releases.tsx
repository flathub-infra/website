import { formatDistance } from "date-fns"
import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react"
import { getIntlLocale, getLocale } from "../../localize"

import { Release } from "../../types/Appstream"
import { useCollapse } from "@collapsed/react"
import { clsx } from "clsx"
import { HiArrowTopRightOnSquare } from "react-icons/hi2"

interface Props {
  latestRelease: Release | null
}

const ReleaseLink = ({
  url,
  noChangeLogProvided = false,
}: {
  url: string
  noChangeLogProvided?: boolean
}) => {
  const { t } = useTranslation()

  if (!url) {
    return null
  }

  return (
    <a
      className="flex items-center gap-2 pb-2 font-normal text-flathub-celestial-blue no-underline hover:underline"
      href={url}
      target="_blank"
      rel="noreferrer"
    >
      {t(noChangeLogProvided ? "release-link-no-changelog" : "release-link")}
      <div className="self-center justify-self-end text-flathub-black opacity-60 dark:text-flathub-gainsborow">
        <HiArrowTopRightOnSquare />
      </div>
    </a>
  )
}

const Releases: FunctionComponent<Props> = ({ latestRelease }) => {
  const ref = useRef(null)
  const { t, i18n } = useTranslation()
  const collapsedHeight = 46
  const [showCollapseButton, setShowCollapseButton] = useState(false)

  useEffect(() => {
    setShowCollapseButton(ref.current.scrollHeight > collapsedHeight)
  }, [ref])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })

  if (
    latestRelease.timestamp &&
    new Date(latestRelease.timestamp * 1000).getUTCFullYear() < 1990
  ) {
    latestRelease.timestamp = undefined
  }

  return (
    <>
      {latestRelease && (
        <div className="rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
          <div>
            <div className="flex flex-col gap-2 px-4 pt-4">
              <header className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <h3 className="my-0 text-xl font-semibold ">
                  {t("changes-in-version", {
                    "version-number": latestRelease.version,
                  })}
                </h3>
                <div
                  className="text-sm"
                  title={
                    latestRelease.timestamp &&
                    new Date(latestRelease.timestamp * 1000).toLocaleDateString(
                      getIntlLocale(i18n.language),
                    )
                  }
                >
                  {latestRelease.timestamp &&
                    formatDistance(
                      new Date(latestRelease.timestamp * 1000),
                      new Date(),
                      { addSuffix: true, locale: getLocale(i18n.language) },
                    )}
                </div>
              </header>
              {latestRelease.description ? (
                <div
                  {...getCollapseProps({ ref })}
                  className={clsx(
                    `prose prose-p:my-0 prose-ul:my-0 relative transition-all duration-700 dark:prose-invert`,
                    !isExpanded &&
                      showCollapseButton &&
                      "from-flathub-white before:absolute before:bottom-0 before:start-0 before:h-1/2 before:w-full before:bg-gradient-to-t before:content-[''] dark:from-flathub-arsenic",
                  )}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: latestRelease.description,
                    }}
                  />
                  <ReleaseLink url={latestRelease.url} />
                </div>
              ) : (
                <div
                  className={`prose prose-p:my-0 dark:prose-invert`}
                  ref={ref}
                >
                  {latestRelease.url ? (
                    <ReleaseLink url={latestRelease.url} noChangeLogProvided />
                  ) : (
                    <ul className="list-disc ps-10">
                      <li>{t("no-changelog-provided")}</li>
                    </ul>
                  )}
                </div>
              )}
            </div>
            {showCollapseButton && (
              <button
                className="w-full rounded-bl-xl rounded-br-xl rounded-tl-none rounded-tr-none border-t px-0 py-3 font-semibold transition hover:cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 dark:border-zinc-600"
                {...getToggleProps()}
              >
                {isExpanded ? (
                  <span>{t("less")}</span>
                ) : (
                  <span>{t("more")}</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Releases
