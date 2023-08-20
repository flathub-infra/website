import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useCallback, useEffect, useState } from "react"
import { toast } from "react-toastify"
import { login } from "../../src/asyncs/login"
import Spinner from "../../src/components/Spinner"
import { useUserContext, useUserDispatch } from "../../src/context/user-info"
import { fetchLoginProviders } from "../../src/fetchers"
import { useLocalStorage } from "../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"
import { isInternalRedirect } from "../../src/utils/security"
import { useMutation } from "@tanstack/react-query"

export default function AuthReturnPage({ services }: { services: string[] }) {
  // Must access query params to POST to backend for oauth verification
  const { t } = useTranslation()
  const router = useRouter()

  const user = useUserContext()
  const dispatch = useUserDispatch()

  const [pendingTransaction] = usePendingTransaction()
  const [returnTo, setReturnTo] = useLocalStorage<string>("returnTo", "")

  const [locale, setLocale] = useState(undefined)

  const loginQuery = useMutation({
    mutationFn: useCallback(
      () => login(dispatch, router.query),
      [dispatch, router.query],
    ),
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

      router.push("/my-flathub", undefined, { locale })
    },
  })

  useEffect(() => {
    if (loginQuery.error) {
      toast.error(t(loginQuery.error as string))
    }
  }, [t, loginQuery.error])

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
      router.push(user.info ? "/my-flathub" : "/", undefined, {
        locale,
      })
      return
    }
  }, [router, user, services, locale])

  // This is purely a loading page
  return (
    <>
      <NextSeo title={t("login")} noindex={true}></NextSeo>
      <Spinner size="l" />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const { data } = await fetchLoginProviders()

  const services = data.map((d) => d.method)

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
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
