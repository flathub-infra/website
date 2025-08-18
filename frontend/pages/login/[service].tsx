import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslations } from "next-intl"

import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { login } from "../../src/asyncs/login"
import Spinner from "../../src/components/Spinner"
import { useUserContext, useUserDispatch } from "../../src/context/user-info"
import { useLocalStorage } from "../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"
import { isInternalRedirect } from "../../src/utils/security"
import { useMutation } from "@tanstack/react-query"
import { getLoginMethodsAuthLoginGet } from "src/codegen"
import { translationMessages } from "i18n/request"

export default function AuthReturnPage({ services }: { services: string[] }) {
  // Must access query params to POST to backend for oauth verification
  const t = useTranslations()
  const router = useRouter()

  const user = useUserContext()
  const dispatch = useUserDispatch()

  const [pendingTransaction] = usePendingTransaction()
  const [returnTo, setReturnTo] = useLocalStorage<string | null>(
    "returnTo",
    null,
  )

  const [locale, setLocale] = useState(undefined)

  const loginQuery = useMutation({
    mutationFn: () => login(dispatch, router.query),
    onSuccess: () => {
      if (pendingTransaction) {
        router.push("/purchase", undefined, { locale })
        return
      } else if (returnTo) {
        const redirect = decodeURIComponent(returnTo)
        setReturnTo(null)

        // Must validate the redirect to prevent open redirect and code execution
        if (isInternalRedirect(redirect)) {
          router.push(redirect, undefined, { locale })
          return
        }
      }

      router.push("/", undefined, { locale })
    },
    onError: (error) => {
      toast.error(t(error.message))
    },
  })

  // Once router ready, perform login
  useEffect(() => {
    // redirect to correct locale, which we stored on the providers page
    if (router.isReady && loginQuery.isIdle) {
      const [, newlocale] = document.cookie
        .split("; ")
        .find((row) => row.startsWith("NEXT_LOCALE="))
        ?.split("=")

      setLocale(newlocale)

      if (newlocale && newlocale !== router.locale) {
        router.push(router.asPath, undefined, { locale: newlocale })
      }

      loginQuery.mutate()
    }
  }, [router.isReady, loginQuery, router])

  // Redirect away if user tries some kind of directory traversal
  useEffect(() => {
    if (!router.isReady) return

    if (
      services.every((s: string) => s !== router.query.service) ||
      router.query.code == null ||
      router.query.state == null
    ) {
      router.push("/", undefined, {
        locale,
      })
      return
    }
  }, [router, user, services, locale])

  // This is purely a loading page
  return (
    <>
      <NextSeo title={t("login")} noindex nofollow />
      <Spinner size="l" />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  const providers = await getLoginMethodsAuthLoginGet()
  const services = providers.data.map((d) => d.method)

  return {
    props: {
      messages: await translationMessages(locale),
      services,
    },
    revalidate: 900,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
