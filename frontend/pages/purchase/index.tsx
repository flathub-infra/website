import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { generateTokens } from "../../src/asyncs/app"
import Main from "../../src/components/layout/Main"
import Spinner from "../../src/components/Spinner"
import { usePendingTransaction } from "../../src/hooks/usePendingTransaction"

const PERMITTED_REDIRECTS = [
  /^http:\/\/localhost:\d+\/$/,
  /^http:\/\/127.0.0.1:\d+\/$/,
]

export default function Purchase() {
  const { t } = useTranslation()
  const [pendingTransaction, setPendingTransaction] = usePendingTransaction()

  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return

    let redirect: string
    let appIDs: string[]

    if ("return" in router.query && "refs" in router.query) {
      redirect = router.query["return"].toString()
      let refs = router.query["refs"].toString().split(";")
      /* We get refs in the form app/<app ID>/<arch>/<branch>, we just want the app ID part */
      appIDs = refs.map((ref) => ref.split("/")[1])
    } else if (pendingTransaction != null) {
      ;({ redirect, appIDs } = pendingTransaction)
    } else {
      toast.error(t("network-error-try-again"))
      return
    }

    if (!PERMITTED_REDIRECTS.some((r) => r.test(redirect))) {
      toast.error(t("incorrect-redirect"))
      return
    }

    generateTokens(appIDs)
      .then((result) => {
        if (result.token) {
          fetch(
            redirect.toString() +
              "success?token=" +
              encodeURIComponent(result.token),
          )
            .then(() => {
              setPendingTransaction(null)
              router.push("/purchase/finished")
            })
            .catch(() => toast.error(t("app-install-error-try-again")))
        } else {
          switch (result.detail) {
            case "not_logged_in":
              setPendingTransaction({
                redirect,
                appIDs,
                missingAppIDs: [],
              })
              router.push("/login")
              break

            case "purchase_necessary":
              setPendingTransaction({
                redirect,
                appIDs,
                missingAppIDs: result.missing_appids,
              })
              router.push("/purchase/checkout")
              break

            default:
              throw "network-error-try-again"
          }
        }
      })
      .catch((err) => toast.error(t(err)))
  }, [router])

  return (
    <Main>
      <NextSeo title={t("purchase-apps-title")} noindex={true} />
      <div className="main-container">
        <Spinner size={150} />;
      </div>
    </Main>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
