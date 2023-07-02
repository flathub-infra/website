import { useEffect } from "react"

import { useMatomo } from "@mitresthen/matomo-tracker-react"
import Header from "./Header"
import Footer from "./Footer"
import { useRouter } from "next/router"

const Main = ({ children, className }) => {
  const { trackPageView } = useMatomo()
  const router = useRouter()

  // Track page view
  useEffect(() => {
    trackPageView({
      customDimensions: [
        {
          id: 1,
          value: router.locale,
        },
      ],
    })
  }, [router.locale, trackPageView])

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
