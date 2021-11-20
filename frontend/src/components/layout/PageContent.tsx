import { NextSeo } from 'next-seo'
import Head from 'next/head'
import { FunctionComponent, useEffect } from 'react'

import Footer from './Footer'
import Header from './Header'
import { useMatomo } from '@datapunt/matomo-tracker-react'
import styles from './PageContent.module.scss'
import { IMAGE_BASE_URL } from '../../env'

const PageContent: FunctionComponent = ({ children }) => {
  const { trackPageView } = useMatomo()

  // Track page view
  useEffect(() => {
    trackPageView({})
  }, [trackPageView])

  return (
    <div id={styles.wrapper}>
      <NextSeo
        titleTemplate='%s—Flathub'
        defaultTitle='Flathub'
        twitter={{ site: '@FlatpakApps' }}
        openGraph={{
          images: [
            {
              url: `${IMAGE_BASE_URL}flathub-logo.png`,
            },
          ],
        }}
      ></NextSeo>
      <Head>
        <base href='/' />

        <link rel='icon' type='image/png' href='./favicon.png' />
      </Head>
      <Header />

      <main>{children}</main>

      <Footer />
    </div>
  )
}

export default PageContent
