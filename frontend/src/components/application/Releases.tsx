import { formatDistance } from 'date-fns'
import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import { getLocale } from '../../localize'

import { Release } from '../../types/Appstream'
import styles from './Releases.module.scss'

interface Props {
  releases: Release[]
}

const Releases: FunctionComponent<Props> = ({ releases }) => {
  const { t, i18n } = useTranslation()
  const latestRelease = releases ? releases[0] : null

  return (
    <>
      {releases && releases.length > 0 && (
        <div className={styles.releases}>
          {latestRelease && (
            <div className={styles.releaseDetails}>
              <header>
                <h3>{t('changes-in-version', { "version-number": latestRelease.version })}</h3>
                <div>
                  {latestRelease.timestamp &&
                    formatDistance(
                      new Date(latestRelease.timestamp * 1000),
                      new Date(),
                      { addSuffix: true, locale: getLocale(i18n.language) }
                    )}
                </div>
              </header>
              <p
                dangerouslySetInnerHTML={{
                  __html: latestRelease.description ?? t('no-changelog-provided'),
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
