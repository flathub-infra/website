import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { useRouter } from "next/router"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { checkPurchases, generateUpdateToken } from "../../src/asyncs/app"
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
      appIDs = router.query["refs"].toString().split(";")
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

    checkPurchases(appIDs)
      .then((result) => {
        if (result["status"] === "ok") {
          generateUpdateToken()
            .then((result) =>
              fetch(
                redirect.toString() +
                  "success?token=" +
                  encodeURIComponent(result.token),
              ),
            )
            .then(() => {
              setPendingTransaction(null)
              router.push("/purchase/finished", undefined, {
                locale: router.locale,
              })
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
              router.push("/login", undefined, { locale: router.locale })
              break

            case "purchase_necessary":
              setPendingTransaction({
                redirect,
                appIDs,
                missingAppIDs: result.missing_appids,
              })
              router.push("/purchase/checkout", undefined, {
                locale: router.locale,
              })
              break

            default:
              throw "network-error-try-again"
          }
        }
      })
      .catch((err) => toast.error(t(err)))
  }, [pendingTransaction, router, setPendingTransaction, t])

  return (
    <>
      <NextSeo title={t("purchase-apps-title")} noindex={true} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <Spinner size="m" />;
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
