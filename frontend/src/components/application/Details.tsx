import { useMatomo } from '@datapunt/matomo-tracker-react'
import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream, pickScreenshot } from '../../types/Appstream'

import { Summary } from '../../types/Summary'

import Releases from './Releases'
import styles from './Details.module.scss'
import Button from '../Button'
import Image from 'next/image'
import { MdChevronRight, MdChevronLeft } from 'react-icons/md'
import CmdInstructions from './CmdInstructions'
import AdditionalInfo from './AdditionalInfo'
import { AppStats } from '../../types/AppStats'

interface Props {
  data: Appstream
  summary: Summary
  stats: AppStats
}

const Details: FunctionComponent<Props> = ({ data, summary, stats }) => {
  const { trackEvent } = useMatomo()

  const installClicked = (e) => {
    e.preventDefault()
    trackEvent({ category: 'App', action: 'Install', name: data.id })
    window.location.href = `https://dl.flathub.org/repo/appstream/${data.id}.flatpakref`
  }

  if (data) {
    const moreThan1Screenshot =
      data.screenshots.filter(pickScreenshot).length > 1

    return (
      <div id={styles.application}>
        <header className={styles.container}>
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
            {data.screenshots
              .filter(pickScreenshot)
              .map((screenshot, index) => (
                <Image
                  key={index}
                  src={pickScreenshot(screenshot)}
                  width={752}
                  height={423}
                  alt='Screenshot'
                  loading='eager'
                />
              ))}
          </Carousel>
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
