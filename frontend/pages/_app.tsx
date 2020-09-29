import type { AppProps } from 'next/app'
import '../styles/globals.css'
import '../styles/main.scss'
import 'react-responsive-carousel/lib/styles/carousel.min.css' // requires a loader

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp
