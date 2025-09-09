"use client"

import { useEffect, Suspense } from "react"

import { useMatomo } from "@mitresthen/matomo-tracker-react"
import Header from "./Header"
import Footer from "./Footer"
import { useLocale } from "next-intl"
import { usePathname } from "src/i18n/navigation"

const Main = ({ children }: { children: React.ReactNode }) => {
  const { trackPageView } = useMatomo()
  const pathname = usePathname()
  const locale = useLocale()

  // Track page view
  useEffect(() => {
    trackPageView({
      href: window.location.href.replace(
        RegExp(`/${locale}$|/${locale}/`),
        "/",
      ),
      customDimensions: [
        {
          id: 1,
          value: locale,
        },
      ],
    })
  })

  return (
    <div
      className={`flex min-h-screen flex-col bg-flathub-lotion dark:bg-flathub-dark-gunmetal`}
    >
      <Suspense
        fallback={
          <div className="h-[68px] bg-flathub-white dark:bg-flathub-dark-gunmetal"></div>
        }
      >
        <Header />
      </Suspense>

      <main className="pt-[68px]">{children}</main>

      <Footer />
    </div>
  )
}

export default Main
