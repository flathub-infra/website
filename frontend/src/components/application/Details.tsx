import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'
import { Appstream } from '../../types/Appstream'
import { ProjectUrl } from '../../types/ProjectUrl'

import { Summary } from '../../types/Summary'
import ProjectUrlWidget from './ProjectUrl'

interface Props {
  data: Appstream
  summary: Summary
}

const Details: FunctionComponent<Props> = ({ data, summary }) => {
  if (data) {
    const latestRelease = data.releases ? data.releases[0] : null
    const moreThan1Screenshot = data.screenshots
      ? data.screenshots.length > 1
      : false

    return (
      <div id='application'>
        <header className='container'>
          <div className='logo'>
            <img
              src={`https://flathub.org/repo/appstream/x86_64/icons/128x128/${data.id}.png`}
              alt='Logo'
            />
          </div>

          <div className='details'>
            <h2>{data.name}</h2>
            <div className='app-summary'>{data.summary}</div>
          </div>

          <div className='install'>
            <a
              href={`https://dl.flathub.org/repo/appstream/${data.id}.flatpakref`}
            >
              <button className='primary-button install-button'>Install</button>
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
            className='description'
            dangerouslySetInnerHTML={{ __html: data.description }}
          />
          {data.releases && data.releases.length > 0 && (
            <div className='releases'>
              {latestRelease && (
                <div className='release-details'>
                  <header>
                    <h3>Changes in version {latestRelease.version}</h3>
                    <div>
                      {new Date(latestRelease.timestamp * 1000).toDateString()}
                    </div>
                  </header>
                  <p
                    className='description'
                    dangerouslySetInnerHTML={{
                      __html: latestRelease.description,
                    }}
                  />
                </div>
              )}
              {data.releases.length > 1 && (
                <div className='history'>Version History</div>
              )}
            </div>
          )}

          <div className='urls'>
            {data.urls && (
              <>
                <div>
                  {data.urls.homepage && (
                    <ProjectUrlWidget
                      url={data.urls.homepage}
                      type={ProjectUrl.Homepage}
                    />
                  )}

                  {data.urls.donation && (
                    <ProjectUrlWidget
                      url={data.urls.donation}
                      type={ProjectUrl.Donate}
                    />
                  )}

                  {data.urls.translate && (
                    <ProjectUrlWidget
                      url={data.urls.translate}
                      type={ProjectUrl.Translate}
                    />
                  )}
                </div>
                <div>
                  {data.urls.bugtracker && (
                    <ProjectUrlWidget
                      url={data.urls.bugtracker}
                      type={ProjectUrl.Bugtracker}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )
  } else {
    return <div>Loading...</div>
  }
}

export default Details
