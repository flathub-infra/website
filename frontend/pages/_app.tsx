import type { AppProps } from 'next/app'
import 'react-responsive-carousel/lib/styles/carousel.min.css' // Requires a loader
import '../styles/globals.css'
import '../styles/main.scss'

const App = ({ Component, pageProps }: AppProps) => <Component {...pageProps} />

export default App
