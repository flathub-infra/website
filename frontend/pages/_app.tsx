import { createInstance, MatomoProvider } from '@datapunt/matomo-tracker-react'
import { DefaultSeo } from 'next-seo'
import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'

import 'react-responsive-carousel/lib/styles/carousel.min.css' // Requires a loader
import { UserInfoProvider } from '../src/context/user-info'
import { IMAGE_BASE_URL } from '../src/env'

import '../styles/main.scss'

const App = ({ Component, pageProps }: AppProps) => {
  const instance = createInstance({
    urlBase: process.env.NEXT_PUBLIC_SITE_BASE_URI,
    siteId: Number(process.env.NEXT_PUBLIC_MATOMO_WEBSITE_ID) || 38,
    trackerUrl: 'https://webstats.gnome.org/matomo.php',
    srcUrl: 'https://webstats.gnome.org/matomo.js',
  })

  return (
    <MatomoProvider value={instance}>
      <ThemeProvider>
        <DefaultSeo
          titleTemplate='%s | Flathub'
          defaultTitle='Flathub'
          twitter={{
            site: '@FlatpakApps',
            cardType: 'summary_large_image',
          }}
          openGraph={{
            type: 'website',
            locale: 'en_GB',
            url: process.env.NEXT_PUBLIC_URL,
            site_name: 'FlatHub',
            images: [
              {
                url: `${IMAGE_BASE_URL}flathub-social.png`,
              },
            ],
          }}
        />
        <UserInfoProvider>
          <Component {...pageProps} />
        </UserInfoProvider>
      </ThemeProvider>
    </MatomoProvider>
  )
}

export default App
