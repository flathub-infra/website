import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { login } from "../../src/asyncs/login"
import Spinner from "../../src/components/Spinner"
import { useUserContext, useUserDispatch } from "../../src/context/user-info"
import { fetchLoginProviders } from "../../src/fetchers"
import { useLocalStorage } from "../../src/hooks/useLocalStorage"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"

export default function AuthReturnPage({ services }) {
  // Must access query params to POST to backend for oauth verification
  const { t } = useTranslation()
  const router = useRouter()

  // Send only one request, prevent infinite loops
  const [sent, setSent] = useState(false)

  const user = useUserContext()
  const dispatch = useUserDispatch()

  const [pendingTransaction, _setPendingTransaction] = usePendingTransaction()
  const [returnTo, setReturnTo] = useLocalStorage<string>("returnTo", "")

  useEffect(() => {
    // Redirect back to where user was, or userpage for unprompted login
    if (user.info && !user.loading) {
      if (pendingTransaction) {
        router.push("/purchase")
      } else if (returnTo) {
        router.push(decodeURIComponent(returnTo))
        setReturnTo(null)
      } else {
        router.push("/userpage")
      }
    }

    // Router must be ready to access query parameters
    if (!router.isReady) {
      return
    }

    // Redirect away if user tries some kind of directory traversal
    if (
      services.every((s: string) => s !== router.query.service) ||
      router.query.code == null ||
      router.query.state == null
    ) {
      router.push(user.info ? "/userpage" : "/")
      return
    }

    if (!sent) {
      setSent(true)
      login(dispatch, router.query).catch((err) => toast.error(t(err)))
    }
  }, [router, dispatch, user, sent, services, t])

  return (
    <>
      <NextSeo title={t("login")} noindex={true}></NextSeo>
      {user.loading ? <Spinner size={200} /> : <></>}
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
    revalidate: 3600,
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
