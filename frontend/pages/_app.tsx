import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'

import 'react-responsive-carousel/lib/styles/carousel.min.css' // Requires a loader

import '../styles/main.scss'

const App = ({ Component, pageProps }: AppProps) => {
  return (
    <ThemeProvider>
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

export default App
