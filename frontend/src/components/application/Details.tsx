import { FunctionComponent } from 'react'
import { Carousel } from 'react-responsive-carousel'

import Appstream from '../../types/Appstream'
import ProjectUrl from '../../types/ProjectUrl'

import ProjectUrlWidget from './ProjectUrl'

interface Props {
  appstream: Appstream
}

const Details: FunctionComponent<Props> = ({ appstream }) => {
  if (appstream) {
    const latestRelease = appstream.releases ? appstream.releases[0] : null
    const moreThan1Screenshot = appstream.screenshots
      ? appstream.screenshots.length > 1
      : false

    return (
      <div id='application'>
        <header className='container'>
          <div className='logo'>
            <img
              src={`https://flathub.org//repo/appstream/x86_64/icons/128x128/${appstream.id}.png`}
              alt='Logo'
            />
          </div>

          <div className='details'>
            <h2>{appstream.name}</h2>
            <div className='developer'>{appstream.developer_name || '-'}</div>
          </div>

          <div className='install'>
            <button className='primary-button install-button'>Install</button>
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
          {appstream.screenshots &&
            appstream.screenshots.map((screenshot, index) => (
              <img
                key={index}
                src={screenshot['752x423']}
                className='carousel-image'
              />
            ))}
        </Carousel>
        <div className='container'>
          <h3 className='summary'>{appstream.summary}</h3>
          <p
            className='description'
            dangerouslySetInnerHTML={{ __html: appstream.description }}
          />
          {appstream.releases && appstream.releases.length > 0 && (
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
              {appstream.releases.length > 1 && (
                <div className='history'>Version History</div>
              )}
            </div>
          )}

          <div className='urls'>
            {appstream.urls && (
              <>
                <div>
                  {appstream.urls.homepage && (
                    <ProjectUrlWidget
                      url={appstream.urls.homepage}
                      type={ProjectUrl.Homepage}
                    />
                  )}

                  {appstream.urls.donation && (
                    <ProjectUrlWidget
                      url={appstream.urls.donation}
                      type={ProjectUrl.Donate}
                    />
                  )}

                  {appstream.urls.translate && (
                    <ProjectUrlWidget
                      url={appstream.urls.translate}
                      type={ProjectUrl.Translate}
                    />
                  )}
                </div>
                <div>
                  {appstream.urls.bugtracker && (
                    <ProjectUrlWidget
                      url={appstream.urls.bugtracker}
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
