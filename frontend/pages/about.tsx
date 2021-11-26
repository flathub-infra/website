import { NextSeo } from 'next-seo'
import Main from '../src/components/layout/Main'
import styles from './about.module.scss'

const About = () => {
  return (
    <Main>
      <NextSeo
        title='About'
        description='Flathub aims to be the place to get and distribute apps for Linux. It is powered by Flatpak which allows Flathub apps to run on almost any Linux distribution.'
      />
      <div
        className={styles.about}
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* <!-- header --> */}
        <header
          style={{ display: 'flex' }}
          className={`${styles.headerContainer} ${styles.storeContentContainerNarrow}`}
        >
          <div className={styles.headerContent}>
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
          className={styles.storeContentContainerNarrow}
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
            <div>Codethink</div>
            <div>Cloud Native Computing Foundation</div>
            <div>Fastly</div>
            <div>Mythic Beasts</div>
            <div>Prerender.io</div>
            <div>Scaleway</div>
            <br />

            <div>Alex Larsson</div>
            <div>Andreas Nilsson</div>
            <div>Arun Raghavan</div>
            <div>Bartłomiej Piotrowski</div>
            <div>Christian Hergert</div>
            <div>Christopher Halse Rogers</div>
            <div>Cosimo Cecchi</div>
            <div>Emmanuele Bassi</div>
            <div>G Stavracas Neto</div>
            <div>Jakub Steiner</div>
            <div>James Shubin</div>
            <div>Joaquim Rocha</div>
            <div>Jorge García Oncins</div>
            <div>Lubomír Sedlář</div>
            <div>Nathan Dyer</div>
            <div>Nick Richards</div>
            <div>Mario Sanchez Prada</div>
            <div>Matthias Clasen</div>
            <div>Michael Doherty</div>
            <div>Robert McQueen</div>
            <div>Zach Oglesby</div>
          </div>
        </section>
      </div>
    </Main>
  )
}

export default About
