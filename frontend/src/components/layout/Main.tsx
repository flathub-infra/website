import { FunctionComponent, useEffect } from "react"

import { useMatomo } from "@jonkoops/matomo-tracker-react"
import Header from "./Header"
import Footer from "./Footer"

const Main = ({ children, className }) => {
  const { trackPageView } = useMatomo()

  // Track page view
  useEffect(() => {
    trackPageView({})
  }, [trackPageView])

  return (
    <div
      className={`${className} flex min-h-screen flex-col bg-flathub-white dark:bg-flathub-dark-gunmetal`}
    >
      <Header />

      <main className="pt-16">{children}</main>

      <Footer />
    </div>
  )
}

export default Main
