import { FunctionComponent } from 'react'
import Appstream from '../../types/Appstream'
import { Carousel } from 'react-responsive-carousel'

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
        <header>
          <div className='app-logo'>
            <img
              src={`https://flathub.org//repo/appstream/x86_64/icons/128x128/${appstream.id}.png`}
              alt='Logo'
            />
          </div>

          <aside>
            <h2>{appstream.name}</h2>
            <p>{appstream.summary}</p>
            <button className='primary-button'>Install</button>
            <br />
            <small>
              Make sure to follow the{' '}
              <a href='https://flatpak.org/setup/'>setup guide</a> before
              installing
            </small>
          </aside>
        </header>
        <Carousel
          showThumbs={moreThan1Screenshot}
          infiniteLoop={moreThan1Screenshot}
          autoPlay={false}
          showArrows={false}
          showIndicators={false}
          swipeable={true}
          emulateTouch={true}
          useKeyboardArrows={true}
          dynamicHeight={true}
          showStatus={false}>
          {appstream.screenshots &&
            appstream.screenshots.map((screenshot, index) => (
              <img
                key={index}
                src={screenshot.large}
                className='carousel-image'
              />
            ))}
        </Carousel>

        <p
          className='description'
          dangerouslySetInnerHTML={{ __html: appstream.description }}
        />

        {latestRelease && latestRelease.description && (
          <div className='release-details'>
            <h3>Changes in version {latestRelease.version}</h3>
            <p
              dangerouslySetInnerHTML={{ __html: latestRelease.description }}
            />
          </div>
        )}
        <hr />

        {appstream.urls && (
          <div className='app-urls'>
            {appstream.urls.homepage && (
              <button
                className='secondary-button'
                style={{ marginRight: '12px' }}>
                Website
              </button>
            )}

            {appstream.urls.donation && (
              <button
                className='secondary-button'
                style={{ marginRight: '12px' }}>
                Donate
              </button>
            )}

            {appstream.urls.bugtracker && (
              <button
                className='secondary-button'
                style={{ marginRight: '12px' }}>
                Issues
              </button>
            )}

            {appstream.urls.translate && (
              <button
                className='secondary-button'
                style={{ marginRight: '12px' }}>
                Translations
              </button>
            )}
          </div>
        )}

        <h3>Additional information</h3>

        <div className='row app-info'>
          <div className='app-info-item'>
            <div className='app-info-title'>Updated</div>
            <div className='app-info-value'>
              {appstream.releases &&
                new Date(latestRelease.timestamp).toDateString()}
            </div>
          </div>
          <div className='app-info-item'>
            <div className='app-info-title'>Version</div>
            <div className='app-info-value'>
              {appstream.releases && latestRelease.version}
            </div>
          </div>
          <div className='app-info-item'>
            <div className='app-info-title'>Category</div>
            <div className='app-info-value'>
              {appstream.categories && appstream.categories.join(', ')}
            </div>
          </div>
          <div className='app-info-item'>
            <div className='app-info-title'>License</div>
            <div className='app-info-value'>{appstream.project_license}</div>
          </div>
          <div className='app-info-item'>
            <div className='app-info-title'>Developer</div>
            <div className='app-info-value'>
              {appstream.developer_name || '-'}
            </div>
          </div>
          <div className='app-info-item'>
            <div className='app-info-title'>Publisher</div>
            <div className='app-info-value'>-</div>
          </div>
        </div>

        <hr />
        <h3>Command line instructions</h3>
        <h5>Install:</h5>
        <small>
          Make sure to follow the{' '}
          <a href='https://flatpak.org/setup/'>setup guide</a> before installing
        </small>
        <pre>flatpak install flathub {appstream.id}</pre>
        <h5>Run:</h5>
        <pre>flatpak run {appstream.id}</pre>
      </div>
    )
  } else {
    return <div>Loading...</div>
  }
}

export default Details
