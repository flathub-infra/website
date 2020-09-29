import Header from './Header'
import Footer from './Footer'
import { FunctionComponent } from 'react'

const Main: FunctionComponent<{}> = ({ children }) => {
  return (
    <main id='wrapper'>
      <Header />

      <div>{children}</div>

      <Footer />
    </main>
  )
}

export default Main
