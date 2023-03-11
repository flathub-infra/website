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
import { useAsync } from "../../src/hooks/useAsync"
import { useLocalStorage } from "../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"
import { isInternalRedirect } from "../../src/utils/security"

export default function AuthReturnPage({ services }: { services: string[] }) {
  // Must access query params to POST to backend for oauth verification
  const { t } = useTranslation()
  const router = useRouter()

  const user = useUserContext()
  const dispatch = useUserDispatch()

  const [pendingTransaction] = usePendingTransaction()
  const [returnTo, setReturnTo] = useLocalStorage<string>("returnTo", "")

  const { execute, status, error } = useAsync(
    useCallback(() => login(dispatch, router.query), [dispatch, router.query]),
    false,
  )

  useEffect(() => {
    if (error) {
      toast.error(t(error))
    }
  }, [t, error])

  // Once router ready, perform login
  useEffect(() => {
    if (router.isReady) {
      execute()
    }
  }, [router.isReady, execute])

  // Prevent mistaken ridirection after stored value is cleared
  const [redirected, setRedirected] = useState(false)

  useEffect(() => {
    if (redirected) return

    // Redirect back to where user was, or userpage for unprompted login
    if (status === "success" && user.info && !user.loading) {
      setRedirected(true)

      if (pendingTransaction) {
        router.push("/purchase")
        return
      } else if (returnTo) {
        const redirect = decodeURIComponent(returnTo)
        setReturnTo(null)

        // Must validate the redirect to prevent open redirect and code execution
        if (isInternalRedirect(redirect)) {
          router.push(redirect)
          return
        }
      }

      router.push("/my-flathub")
    }
  }, [
    status,
    user,
    pendingTransaction,
    returnTo,
    router,
    redirected,
    setReturnTo,
  ])

  // Redirect away if user tries some kind of directory traversal
  useEffect(() => {
    if (!router.isReady) return

    if (
      services.every((s: string) => s !== router.query.service) ||
      router.query.code == null ||
      router.query.state == null
    ) {
      router.push(user.info ? "/my-flathub" : "/")
      return
    }
  }, [router, user, services])

  // This is purely a loading page
  return (
    <>
      <NextSeo title={t("login")} noindex={true}></NextSeo>
      <Spinner size="l" />
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const data = await fetchLoginProviders()

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
