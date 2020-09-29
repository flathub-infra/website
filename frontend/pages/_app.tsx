import type { AppProps } from 'next/app'

import 'react-responsive-carousel/lib/styles/carousel.min.css' // requires a loader

import '../styles/globals.css'
import '../styles/main.scss'

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp
