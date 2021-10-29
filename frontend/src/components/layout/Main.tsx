import { FunctionComponent } from 'react'

import { MatomoProvider, createInstance } from '@datapunt/matomo-tracker-react'
import { MATOMO_WEBSITE_ID } from '../../env'
import PageContent from './PageContent'

const instance = createInstance({
  urlBase: process.env.BASE_URI ?? 'https://www.flathub.org',
  siteId: MATOMO_WEBSITE_ID,
  trackerUrl: 'https://webstats.gnome.org/matomo.php',
  srcUrl: 'https://webstats.gnome.org/matomo.js',
})

const Main: FunctionComponent = ({ children }) => {
  return (
    <MatomoProvider value={instance}>
      <PageContent>{children}</PageContent>
    </MatomoProvider>
  )
}

export default Main
