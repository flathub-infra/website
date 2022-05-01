import { useMatomo } from "@datapunt/matomo-tracker-react"
import { formatDistance } from "date-fns"
import { FunctionComponent, useState } from "react"
import { MdInfo, MdOpenInNew } from "react-icons/md"

import { AddonAppstream } from "../../types/Appstream"
import styles from "./Addons.module.scss"

interface Props {
  addons: AddonAppstream[]
}

const Addons: FunctionComponent<Props> = ({ addons }) => {
  const { trackEvent } = useMatomo()

  const [isInfoVisible, setInfoVisible] = useState(false)

  function toggleInfoVisible() {
    setInfoVisible(!isInfoVisible)
  }

  return (
    <>
      {addons && addons.length > 0 && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3>Available add-ons</h3>
            <>
              <span className={styles.tooltip} onClick={toggleInfoVisible}>
                <MdInfo />
                <div
                  className={styles.tooltiptext}
                  style={
                    isInfoVisible
                      ? { visibility: "visible" }
                      : { display: "hidden" }
                  }
                >
                  Please use the flatpak manager supplied by your distribution
                  to install add-ons.
                </div>
              </span>
            </>
          </div>
          <div className={styles.addons}>
            {addons.map((addon) => {
              const latestRelease = addon.releases ? addon.releases[0] : null
              const linkClicked = () => {
                trackEvent({
                  category: "App",
                  action: "AddonHomepage",
                  name: addon.id ?? "unknownAddon",
                })
              }
              return (
                <div className={styles.addon} key={addon.id}>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <h3>{addon.name}</h3>
                    {latestRelease && latestRelease.timestamp && (
                      <div className={styles.time}>
                        updated{" "}
                        {formatDistance(
                          new Date(latestRelease.timestamp * 1000),
                          new Date(),
                          { addSuffix: true },
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <p>{addon.summary}</p>
                    {addon.urls.homepage && (
                      <div className={styles.externalLink}>
                        <a
                          href={addon.urls.homepage}
                          target="_blank"
                          rel="noreferrer"
                          onClick={linkClicked}
                          title="Open in new tab"
                        >
                          <MdOpenInNew />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

export default Addons
