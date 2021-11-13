import { useMatomo } from '@datapunt/matomo-tracker-react'
import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream } from '../../types/Appstream'

import { Summary } from '../../types/Summary'

import Releases from './Releases'
import styles from './Details.module.scss'
import ProjectUrls from './ProjectUrls'
import Button from '../Button'

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
            <img
              src={`https://flathub.org/repo/appstream/x86_64/icons/128x128/${data.id}.png`}
              alt='Logo'
            />
          </div>

          <div className={styles.details}>
            <h2>{data.name}</h2>
            <div className={styles.appSummary}>{data.summary}</div>
          </div>

          <div className={styles.install}>
            <Button onClick={installClicked}>Install</Button>
          </div>
        </header>
        <div className={`${styles.carousel}`}>
          <Carousel
            className={styles.container}
            showThumbs={false}
            infiniteLoop={true}
            autoPlay={true}
            showArrows={true}
            showIndicators={moreThan1Screenshot}
            swipeable={true}
            emulateTouch={true}
            useKeyboardArrows={true}
            dynamicHeight={false}
            showStatus={false}
            renderArrowNext={(handler, hasNext, label) =>
              hasNext ? (
                <div onClick={handler} className='control-arrow control-next'>
                  <img src='/go-next.svg' />
                </div>
              ) : (
                <></>
              )
            }
            renderArrowPrev={(handler, hasPrev, label) =>
              hasPrev ? (
                <div
                  onClick={handler}
                  className='control-arrow control-prev'
                  style={{ transform: 'rotateY(180deg)' }}
                >
                  <img src='/go-next.svg' />
                </div>
              ) : (
                <></>
              )
            }
          >
            {data.screenshots &&
              data.screenshots.map((screenshot, index) => (
                <img key={index} src={screenshot['752x423']} />
              ))}
          </Carousel>
        </div>
        <div className={styles.container}>
          <p
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
          <Releases releases={data.releases}></Releases>

          <ProjectUrls urls={data.urls} appId={data.id}></ProjectUrls>
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
