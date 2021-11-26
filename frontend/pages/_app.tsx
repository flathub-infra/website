import { DefaultSeo } from 'next-seo'
import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'

import 'react-responsive-carousel/lib/styles/carousel.min.css' // Requires a loader
import { IMAGE_BASE_URL } from '../src/env'

import '../styles/main.scss'

const App = ({ Component, pageProps }: AppProps) => {
  return (
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
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

export default App
