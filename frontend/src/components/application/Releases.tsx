import { formatDistance } from 'date-fns'
import { FunctionComponent } from 'react'

import { Release } from '../../types/Appstream'
import styles from './Releases.module.scss'

interface Props {
  releases: Release[]
}

const Releases: FunctionComponent<Props> = ({ releases }) => {
  const latestRelease = releases ? releases[0] : null

  return (
    <>
      {releases && releases.length > 0 && (
        <div className={styles.releases}>
          {latestRelease && (
            <div className={styles.releaseDetails}>
              <header>
                <h3>Changes in version {latestRelease.version}</h3>
                <div>
                  {formatDistance(
                    new Date(latestRelease.timestamp * 1000),
                    new Date(),
                    { addSuffix: true }
                  )}
                </div>
              </header>
              <p
                className={styles.description}
                dangerouslySetInnerHTML={{
                  __html: latestRelease.description ?? 'No changelog provided',
                }}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default Releases
