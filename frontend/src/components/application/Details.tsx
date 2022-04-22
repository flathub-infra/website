import { useMatomo } from '@datapunt/matomo-tracker-react'
import { FunctionComponent, useState } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream, pickScreenshot } from '../../types/Appstream'
import { useTranslation } from 'next-i18next'

import { Summary } from '../../types/Summary'

import Releases from './Releases'
import styles from './Details.module.scss'
import Button from '../Button'
import Image from '../Image'
import { MdChevronRight, MdChevronLeft, MdZoomIn } from 'react-icons/md'
import CmdInstructions from './CmdInstructions'
import AdditionalInfo from './AdditionalInfo'
import { AppStats } from '../../types/AppStats'
import AppStatistics from './AppStats'
import { SoftwareAppJsonLd, VideoGameJsonLd } from 'next-seo'
import Lightbox from 'react-image-lightbox'
import ApplicationSection from './ApplicationSection'
import LogoImage from '../LogoImage'
import { calculateHumanReadableSize } from '../../size'

import 'react-image-lightbox/style.css' // This only needs to be imported once in your app

interface Props {
  app: Appstream
  summary?: Summary
  stats: AppStats
  developerApps: Appstream[]
}

function categoryToSeoCategories(categories: string[]) {
  if (!categories) {
    return ''
  }

  return categories.map(categoryToSeoCategory).join(' ')
}
function categoryToSeoCategory(category) {
  switch (category) {
    case 'AudioVideo':
      return 'MultimediaApplication'
    case 'Development':
      return 'DeveloperApplication'
    case 'Education':
      return 'EducationalApplication'
    case 'Game':
      return 'GameApplication'
    case 'Graphics':
      return 'DesignApplication'
    case 'Network':
      return 'SocialNetworkingApplication'
    case 'Office':
      return 'BusinessApplication'
    case 'Science':
      // Unsure what else we could map this to
      return 'EducationalApplication'
    case 'System':
      return 'DesktopEnhancementApplication'
    case 'Utility':
      return 'UtilitiesApplication'
  }
}

const Details: FunctionComponent<Props> = ({
  app,
  summary,
  stats,
  developerApps,
}) => {
  const { t } = useTranslation()
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState(0)

  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: 'App', action: 'Install', name: app.id })
    window.location.href = `https://dl.flathub.org/repo/appstream/${app.id}.flatpakref`
  }

  const donateClicked = (e) => {
    trackEvent({ category: 'App', action: 'Donate', name: app.id })
  }

  if (app) {
    const moreThan1Screenshot =
      app.screenshots?.filter(pickScreenshot).length > 1

    return (
      <div id={styles.application}>
        <SoftwareAppJsonLd
          name={app.name}
          price='0'
          priceCurrency=''
          operatingSystem='LINUX'
          applicationCategory={categoryToSeoCategories(app.categories)}
        />
        {app.categories?.includes('Game') && (
          <VideoGameJsonLd
            name={app.name}
            authorName={app.developer_name}
            operatingSystemName={'LINUX'}
            storageRequirements={
              summary
                ? calculateHumanReadableSize(summary.download_size)
                : t('unknown')
            }
          />
        )}
        <header>
          {app.icon && (
            <div className={styles.logo}>
              <LogoImage iconUrl={app.icon} appName={app.name} />
            </div>
          )}

          <div className={styles.details}>
            <h2>{app.name}</h2>
            {app.developer_name?.trim().length > 0 && (
              <div className={styles.devName}>
                {t('by', { developer: app.developer_name })}
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <Button onClick={installClicked}>{t('install')}</Button>
            {app.urls?.donation && (
              <a
                href={app.urls.donation}
                target='_blank'
                rel='noreferrer'
                onClick={donateClicked}
                className={styles.secondaryButton}
              >
                <Button variant='secondary'>{t('donate')}</Button>
              </a>
            )}
          </div>
        </header>
        <div className={`${styles.carousel}`}>
          {showLightbox && (
            <Lightbox
              mainSrc={
                pickScreenshot(
                  app.screenshots?.filter(pickScreenshot)[currentScreenshot]
                ).url
              }
              onCloseRequest={() => setShowLightbox(false)}
            />
          )}
          <div className={styles.carouselWrapper}>
            {app.screenshots && app.screenshots.length > 0 && (
              <Button
                className={styles.zoom}
                onClick={() => setShowLightbox(true)}
                aria-label={t('zoom')}
              >
                <MdZoomIn />
              </Button>
            )}
            <Carousel
              showThumbs={false}
              infiniteLoop={true}
              autoPlay={false}
              showArrows={true}
              showIndicators={moreThan1Screenshot}
              swipeable={true}
              emulateTouch={true}
              useKeyboardArrows={true}
              dynamicHeight={false}
              showStatus={false}
              onChange={(index) => {
                setCurrentScreenshot(index)
              }}
              renderArrowNext={(handler, hasNext, label) =>
                hasNext ? (
                  <div className='control-arrow control-next' onClick={handler}>
                    <MdChevronRight />
                  </div>
                ) : (
                  <></>
                )
              }
              renderArrowPrev={(handler, hasPrev, label) =>
                hasPrev ? (
                  <div className='control-arrow control-prev' onClick={handler}>
                    <MdChevronLeft />
                  </div>
                ) : (
                  <></>
                )
              }
            >
              {app.screenshots
                ?.filter(pickScreenshot)
                .map((screenshot, index) => {
                  const pickedScreenshot = pickScreenshot(screenshot)
                  return (
                    <Image
                      key={index}
                      src={pickedScreenshot.url}
                      width={752}
                      height={423}
                      alt={t('screenshot')}
                      loading='eager'
                      priority={index === 0}
                    />
                  )
                })}
            </Carousel>
          </div>
        </div>
        <div className={styles.additionalInfo}>
          <div>
            <h3>{app.summary}</h3>
            <div
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: app.description }}
            />
          </div>

          <Releases
            latestRelease={app.releases ? app.releases[0] : null}
          ></Releases>

          <AdditionalInfo
            data={app}
            summary={summary}
            appId={app.id}
            stats={stats}
          ></AdditionalInfo>

          {developerApps && developerApps.length > 0 && (
            <ApplicationSection
              href={`/apps/collection/developer/${app.developer_name}`}
              title={t('other-apps-by-developer', {
                developer: app.developer_name,
              })}
              applications={developerApps.slice(0, 6)}
              showMore={developerApps.length > 6}
            />
          )}

          <AppStatistics stats={stats}></AppStatistics>

          <CmdInstructions appId={app.id}></CmdInstructions>
        </div>
      </div>
    )
  } else {
    return (
      <div className='main-container'>
        <div>{t('loading')}</div>
      </div>
    )
  }
}

export default Details
