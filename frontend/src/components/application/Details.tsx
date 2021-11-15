import { useMatomo } from '@datapunt/matomo-tracker-react'
import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream } from '../../types/Appstream'

import { Summary } from '../../types/Summary'

import Releases from './Releases'
import styles from './Details.module.scss'
import ProjectUrls from './ProjectUrls'
import Button from '../Button'
import Image from 'next/image'
import { MdChevronRight, MdChevronLeft } from 'react-icons/md'
import CmdInstructions from './CmdInstructions'

interface Props {
  data: Appstream
  summary: Summary
}

const Details: FunctionComponent<Props> = ({ data, summary }) => {
  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: 'App', action: 'Install', name: data.id })
    window.location.href = `https://dl.flathub.org/repo/appstream/${data.id}.flatpakref`
  }

  if (data) {
    const moreThan1Screenshot = data.screenshots
      ? data.screenshots.length > 1
      : false

    return (
      <div id={styles.application}>
        <header className={styles.container}>
          <div className={styles.logo}>
            <img src={data.icon} alt='Logo' />
          </div>

          <div className={styles.details}>
            <h2>{data.name}</h2>
            <div className={styles.appSummary}>{data.summary}</div>
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
          <Carousel
            className={styles.container}
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
            {data.screenshots &&
              data.screenshots.map((screenshot, index) => (
                <Image
                  key={index}
                  src={screenshot['752x423']}
                  width={752}
                  height={423}
                  alt='Screenshot'
                  loading='eager'
                />
              ))}
          </Carousel>
        </div>
        <div className={styles.bla}>
          <p
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: data.description }}
          />

          <Releases releases={data.releases}></Releases>

          <ProjectUrls urls={data.urls} appId={data.id}></ProjectUrls>

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
