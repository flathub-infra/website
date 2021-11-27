import { useMatomo } from '@datapunt/matomo-tracker-react'
import { FunctionComponent, useState } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream, pickScreenshot } from '../../types/Appstream'

import { Summary } from '../../types/Summary'

import Releases from './Releases'
import styles from './Details.module.scss'
import Button from '../Button'
import Image from 'next/image'
import { MdChevronRight, MdChevronLeft, MdZoomIn } from 'react-icons/md'
import CmdInstructions from './CmdInstructions'
import AdditionalInfo from './AdditionalInfo'
import { AppStats } from '../../types/AppStats'
import AppStatistics from './AppStats'
import { SoftwareAppJsonLd, VideoGameJsonLd } from 'next-seo'
import Lightbox from 'react-image-lightbox'

import 'react-image-lightbox/style.css' // This only needs to be imported once in your app

interface Props {
  data: Appstream
  summary: Summary
  stats: AppStats
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

const Details: FunctionComponent<Props> = ({ data, summary, stats }) => {
  const [showLightbox, setShowLightbox] = useState(false)
  const [currentScreenshot, setCurrentScreenshot] = useState(0)

  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: 'App', action: 'Install', name: data.id })
    window.location.href = `https://dl.flathub.org/repo/appstream/${data.id}.flatpakref`
  }

  if (data) {
    const moreThan1Screenshot =
      data.screenshots?.filter(pickScreenshot).length > 1

    return (
      <div id={styles.application}>
        <SoftwareAppJsonLd
          name={data.name}
          price='0'
          priceCurrency=''
          operatingSystem='LINUX'
          applicationCategory={categoryToSeoCategories(data.categories)}
        />
        {data.categories?.includes('Game') && (
          <VideoGameJsonLd
            name={data.name}
            authorName={data.developer_name}
            operatingSystemName={'LINUX'}
            storageRequirements={
              Math.round(summary.installed_size / 1_000_000) + ' MB'
            }
          />
        )}
        <header>
          <div className={styles.logo}>
            <img src={data.icon} alt='Logo' />
          </div>

          <div className={styles.details}>
            <h2>{data.name}</h2>
            <div className={styles.devName}>by {data.developer_name}</div>
          </div>

          <div className={styles.install}>
            <Button onClick={installClicked}>Install</Button>
            {data.urls.donation && (
              <a href={data.urls.donation} target='_blank' rel='noreferrer'>
                <Button type='secondary'>Donate</Button>
              </a>
            )}
          </div>
        </header>
        <div className={`${styles.carousel}`}>
          {showLightbox && (
            <Lightbox
              mainSrc={
                pickScreenshot(
                  data.screenshots?.filter(pickScreenshot)[currentScreenshot]
                ).url
              }
              onCloseRequest={() => setShowLightbox(false)}
            />
          )}
          <div className={styles.carouselWrapper}>
            {data.screenshots && (
              <div
                className={styles.zoom}
                onClick={() => setShowLightbox(true)}
              >
                <MdZoomIn />
              </div>
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
              {data.screenshots
                ?.filter(pickScreenshot)
                .map((screenshot, index) => {
                  const pickedScreenshot = pickScreenshot(screenshot)
                  return (
                    <Image
                      key={index}
                      src={pickedScreenshot.url}
                      width={752}
                      height={423}
                      alt='Screenshot'
                      loading='eager'
                    />
                  )
                })}
            </Carousel>
          </div>
        </div>
        <div className={styles.additionalInfo}>
          <div>
            <h3>{data.summary}</h3>
            <p
              className={styles.description}
              dangerouslySetInnerHTML={{ __html: data.description }}
            />
          </div>

          <Releases releases={data.releases}></Releases>

          <AdditionalInfo
            data={data}
            summary={summary}
            appId={data.id}
            stats={stats}
          ></AdditionalInfo>

          <AppStatistics stats={stats}></AppStatistics>

          <CmdInstructions appId={data.id}></CmdInstructions>
        </div>
      </div>
    )
  } else {
    return (
      <div className='main-container'>
        <div>Loading...</div>
      </div>
    )
  }
}

export default Details
