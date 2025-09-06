"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import LoginProviders from "../../../src/components/login/Providers"
import { useUserContext } from "../../../src/context/user-info"
import type { JSX } from "react"
import { useRouter } from "src/i18n/navigation"

interface LoginClientProps {
  providers: any[]
  locale: string
}

const LoginClient = ({ providers, locale }: LoginClientProps): JSX.Element => {
  const t = useTranslations()
  const user = useUserContext()
  const router = useRouter()

  // Set NEXT_LOCALE cookie to match locale of this page
  useEffect(() => {
    if (!locale) return
    document.cookie = `NEXT_LOCALE=${locale};path=/;SameSite=Strict`
  }, [locale])

  useEffect(() => {
    // Already logged in, just redirect to userpage
    if (user.info && !user.loading) {
      router.replace("/")
    }
  }, [user, router])

  return <LoginProviders providers={providers} />
}

export default LoginClient
