import { GetStaticProps } from 'next'
import { Trans, useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { NextSeo } from 'next-seo'
import Main from '../src/components/layout/Main'
import styles from './about.module.scss'

const About = () => {
  const { t } = useTranslation()

  return (
    <Main>
      <NextSeo
        title={t('about')}
        description={t('about-description')}
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
            <h1>{t('about-pagename')}</h1>
            <Trans i18nKey={"common:about-block"}>
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
            </Trans>
          </div>
        </header>

        {/* <!-- main content --> */}
        <section
          style={{ display: 'flex', flexDirection: 'column' }}
          className={styles.storeContentContainerNarrow}
        >
          <h2>{t('submitting-apps')}</h2>
          <Trans i18nKey={"common:submitting-apps-block"}>
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
          </Trans>

          <h2>{t('get-involved')}</h2>
          <Trans i18nKey={"common:get-involved-block"}>
            <p>
              Flathub is an attempt to transform the Linux desktop ecosystem for
              the better, and we need your help. If you can write documentation,
              create websites, administer servers or write code, we would love
              your help.
            </p>
          </Trans>

          <h2>{t('reporting-issues')}</h2>
          <Trans i18nKey={"common:reporting-issues-block"}>
            <p>
              Security or legal issues can be reported to the{' '}
              <a href='mailto:flathub@lists.freedesktop.org'>
                Flathub maintainers
              </a>
              .
            </p>
          </Trans>

          <h2>{t('acknowledgements')}</h2>
          <Trans i18nKey={"common:acknowledgements-block"}>
            <p>
              Flathub wouldn&apos;t be possible without the generous support of
              the following organizations and individuals.
            </p>
          </Trans>
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
      </div >
    </Main >
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}


export default About
