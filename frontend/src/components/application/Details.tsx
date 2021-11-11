import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream } from '../../types/Appstream'
import { ProjectUrl } from '../../types/ProjectUrl'

import { Summary } from '../../types/Summary'
import ProjectUrlWidget from './ProjectUrl'
import Releases from './Releases'
import styles from './Details.module.scss'
import ProjectUrls from './ProjectUrls'

interface Props {
  data: Appstream
  summary: Summary
}

const Details: FunctionComponent<Props> = ({ data, summary }) => {
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
            <a
              href={`https://dl.flathub.org/repo/appstream/${data.id}.flatpakref`}
            >
              <button className={`primary-button ${styles.installButton}`}>
                Install
              </button>
            </a>
          </div>
        </header>
        <Carousel
          showThumbs={false}
          infiniteLoop={false}
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
        <div className='container'>
          <p
            className={styles.description}
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
          <Releases releases={data.releases}></Releases>

          <ProjectUrls urls={data.urls}></ProjectUrls>
        </div>
      </div>
    )
  } else {
    return <div>Loading...</div>
  }
}

export default Details
