import type { AppProps } from 'next/app'

import 'react-responsive-carousel/lib/styles/carousel.min.css' // Requires a loader

import '../styles/globals.scss'
import '../styles/main.scss'

const App = ({ Component, pageProps }: AppProps) => <Component {...pageProps} />

export default App
