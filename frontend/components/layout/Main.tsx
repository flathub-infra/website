import Header from './Header'
import Footer from './Footer'
import { FunctionComponent } from 'react'
interface Props {}

const Main: FunctionComponent<Props> = ({ children }) => {
  return (
    <main id='wrapper'>
      <Header />

      <div>{children}</div>

      <Footer />
    </main>
  )
}

export default Main
