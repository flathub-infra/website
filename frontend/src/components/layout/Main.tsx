import { FunctionComponent } from 'react'

import Footer from './Footer'
import Header from './Header'

const Main: FunctionComponent = ({ children }) => (
  <main id='wrapper'>
    <Header />

    <div>{children}</div>

    <Footer />
  </main>
)

export default Main
