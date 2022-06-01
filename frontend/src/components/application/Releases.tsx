import { formatDistance } from "date-fns"
import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useMemo, useRef, useState } from "react"
import { getLocale } from "../../localize"

import { Release } from "../../types/Appstream"
import styles from "./Releases.module.scss"
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

  const releaseDescription = useMemo(
    () => (latestRelease.description ? latestRelease.description : noChangelog),
    [latestRelease.description, noChangelog],
  )

  return (
    <>
      {latestRelease && (
        <div className={styles.releases}>
          <div className={styles.release}>
            <div className={styles.releaseDetails}>
              <header>
                <h3>
                  {t("changes-in-version", {
                    "version-number": latestRelease.version,
                  })}
                </h3>
                <div
                  title={
                    latestRelease.timestamp &&
                    new Date(latestRelease.timestamp * 1000).toLocaleDateString(
                      i18n.language.substring(0, 2),
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
                className={`${styles.releaseContent} prose dark:prose-invert ${
                  !isExpanded && scrollHeight > collapsedHeight
                    ? styles.collapsed
                    : ""
                }`}
                ref={ref}
                dangerouslySetInnerHTML={{
                  __html: releaseDescription,
                }}
              />
            </div>
            {scrollHeight > collapsedHeight && (
              <button className={styles.expandButton} {...getToggleProps()}>
                {isExpanded ? (
                  <span className={styles.expandText}>{t("less")}</span>
                ) : (
                  <span className={styles.expandText}>{t("more")}</span>
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
