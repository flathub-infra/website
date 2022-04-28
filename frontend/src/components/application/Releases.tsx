import { formatDistance } from "date-fns"
import { useTranslation } from "next-i18next"
import {
  FunctionComponent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
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

  useLayoutEffect(() => {
    setScrollHeight(ref.current.scrollHeight)
  }, [ref])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })
  const { t, i18n } = useTranslation()

  const noChangelog = useMemo(
    () => `<ul><li>${t("no-changelog-provided")}</li></ul>`,
    [t],
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
                <div>
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
                className={`${styles.releaseContent} ${
                  !isExpanded && scrollHeight > collapsedHeight
                    ? styles.collapsed
                    : ""
                }`}
                ref={ref}
                dangerouslySetInnerHTML={{
                  __html: latestRelease.description ?? noChangelog,
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
