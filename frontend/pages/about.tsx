import { IMAGE_BASE_URL } from '../src/env'
import { NextSeo } from 'next-seo'
import Main from '../src/components/layout/Main'

const About = () => {
  return (
    <Main>
      <NextSeo
        title='About'
        description='Flathub aims to be the place to get and distribute apps for Linux. It is powered by Flatpak which allows Flathub apps to run on almost any Linux distribution.'
        openGraph={{
          images: [
            {
              url: `${IMAGE_BASE_URL}logo/flathub-logo.png`,
            },
          ],
        }}
      />
      <div
        className='about'
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* <!-- header --> */}
        <header
          style={{ display: 'flex' }}
          className='header-container store-content-container-narrow'
        >
          <div className='header-content'>
            <h1>About Flathub</h1>

            <p>
              Flathub aims to be the place to get and distribute apps for Linux.
              It is powered by <a href='https://flatpak.org'>Flatpak</a> which
              allows Flathub apps to run on almost any Linux distribution.
            </p>

            <p>
              If you are a Linux user, you can use Flathub to gain access to a
              growing collection of Flatpak applications. You just need to
              follow the{' '}
              <a href='https://flatpak.org/setup/'>setup instructions</a>.
            </p>
          </div>
        </header>

        {/* <!-- main content --> */}
        <section
          style={{ display: 'flex', flexDirection: 'column' }}
          className='store-content-container-narrow'
        >
          <h2>Submitting apps</h2>
          <p>
            App developers can{' '}
            <a href='https://github.com/flathub/flathub/wiki/App-Submission'>
              submit their applications
            </a>{' '}
            to be distributed to Flathub&apos;s growing user base, thus
            providing a single gateway to the entire Linux desktop ecosystem.
          </p>
          <p>
            At the moment, applications must either be legally redistributable
            or be available as a third party download. However, if you are a
            proprietary app developer and are interested in using Flathub, we
            would love to talk to you.
          </p>

          <h2>Get involved</h2>
          <p>
            Flathub is an attempt to transform the Linux desktop ecosystem for
            the better, and we need your help. If you can write documentation,
            create websites, administer servers or write code, we would love
            your help.
          </p>

          <h2>Reporting issues</h2>
          <p>
            Security or legal issues can be reported to the{' '}
            <a href='mailto:flathub@lists.freedesktop.org'>
              Flathub maintainers
            </a>
            .
          </p>

          <h2>Acknowledgements</h2>
          <p>
            Flathub wouldn&apos;t be possible without the generous support of
            the following organizations and individuals.
          </p>
          <div>
            <div className='row'>Codethink</div>
            <div className='row'>Cloud Native Computing Foundation</div>
            <div className='row'>Fastly</div>
            <div className='row'>Mythic Beasts</div>
            <div className='row'>Prerender.io</div>
            <div className='row'>Scaleway</div>
            <br />

            <div className='row largegap'>Alex Larsson</div>
            <div className='row'>Andreas Nilsson</div>
            <div className='row'>Arun Raghavan</div>
            <div className='row'>Bartłomiej Piotrowski</div>
            <div className='row'>Christian Hergert</div>
            <div className='row'>Christopher Halse Rogers</div>
            <div className='row'>Cosimo Cecchi</div>
            <div className='row'>Emmanuele Bassi</div>
            <div className='row'>G Stavracas Neto</div>
            <div className='row'>Jakub Steiner</div>
            <div className='row'>James Shubin</div>
            <div className='row'>Joaquim Rocha</div>
            <div className='row'>Jorge García Oncins</div>
            <div className='row'>Lubomír Sedlář</div>
            <div className='row'>Nathan Dyer</div>
            <div className='row'>Nick Richards</div>
            <div className='row'>Mario Sanchez Prada</div>
            <div className='row'>Matthias Clasen</div>
            <div className='row'>Michael Doherty</div>
            <div className='row'>Robert McQueen</div>
            <div className='row'>Zach Oglesby</div>
          </div>
        </section>
      </div>
    </Main>
  )
}

export default About
