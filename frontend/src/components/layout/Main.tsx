import { useEffect } from "react"

import { useMatomo } from "@mitresthen/matomo-tracker-react"
import Header from "./Header"
import Footer from "./Footer"
import { useRouter } from "next/router"

const Main = ({ children }: { children: React.ReactNode }) => {
  const { trackPageView } = useMatomo()
  const router = useRouter()

  // Track page view
  useEffect(() => {
    trackPageView({
      href: window.location.href.replace(
        RegExp(`/${router.locale}$|/${router.locale}/`),
        "/",
      ),
      customDimensions: [
        {
          id: 1,
          value: router.locale,
        },
      ],
    })
  })

  return (
    <div
      className={`flex min-h-screen flex-col bg-flathub-lotion dark:bg-flathub-dark-gunmetal`}
    >
      <Header />

      <main className="pt-[68px]">{children}</main>

      <Footer />
    </div>
  )
}

export default Main
