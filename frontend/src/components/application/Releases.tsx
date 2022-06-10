import { formatDistance } from "date-fns"
import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react"
import { getIntlLocale, getLocale } from "../../localize"

import { Release } from "../../types/Appstream"
import useCollapse from "react-collapsed"

interface Props {
  latestRelease: Release | null
}

const Releases: FunctionComponent<Props> = ({ latestRelease }) => {
  const collapsedHeight = 60
  const [scrollHeight, setScrollHeight] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    setScrollHeight(ref.current.scrollHeight)
  }, [ref])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })
  const { t, i18n } = useTranslation()

  const noChangelog = useMemo(
    () =>
      `<ul class='list-disc my-4 pl-10'><li>${t(
        "no-changelog-provided",
      )}</li></ul>`,
    [t],
  )

  var releaseDescription = useMemo(
    () => (latestRelease.description ? latestRelease.description : noChangelog),
    [latestRelease.description, noChangelog],
  )

  if (latestRelease.url) {
    releaseDescription +=
      "<a href='" +
      latestRelease.url +
      "' class='list-disc my-4 pl-10' target='_blank' rel='noreferrer'>" +
      t("release-link") +
      "</a>"
  }

  return (
    <>
      {latestRelease && (
        <div className="rounded-xl bg-bgColorSecondary shadow-md">
          <div>
            <div className="flex flex-col gap-2 px-4 pt-4">
              <header className="flex flex-row justify-between gap-2">
                <h3 className="my-0">
                  {t("changes-in-version", {
                    "version-number": latestRelease.version,
                  })}
                </h3>
                <div
                  className="self-center text-sm"
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
              <div
                {...getCollapseProps()}
                className={`prose relative dark:prose-invert ${
                  !isExpanded && scrollHeight > collapsedHeight
                    ? "from-transparent to-bgColorSecondary before:absolute before:left-0 before:top-0 before:h-full before:w-full before:bg-gradient-to-b before:content-['']"
                    : ""
                }`}
                ref={ref}
                dangerouslySetInnerHTML={{
                  __html: releaseDescription,
                }}
              />
            </div>
            {scrollHeight > collapsedHeight && (
              <button
                className="w-full rounded-bl-xl rounded-br-xl py-3 px-0 hover:cursor-pointer hover:bg-colorHighlight hover:text-gray-100"
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
