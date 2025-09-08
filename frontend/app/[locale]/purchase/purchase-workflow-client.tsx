"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { toast } from "sonner"
import Spinner from "../../../src/components/Spinner"
import { usePendingTransaction } from "../../../src/hooks/usePendingTransaction"
import {
  checkPurchasesPurchasesCheckPurchasesPost,
  getUpdateTokenPurchasesGenerateUpdateTokenPost,
} from "../../../src/codegen"
import { useRouter } from "src/i18n/navigation"

const PERMITTED_REDIRECTS = [
  /^http:\/\/localhost:\d+\/$/,
  /^http:\/\/127.0.0.1:\d+\/$/,
]

export default function PurchaseWorkflowClient() {
  const t = useTranslations()
  const [pendingTransaction, setPendingTransaction] = usePendingTransaction()
  const router = useRouter()

  useEffect(() => {
    // Get URL parameters from search params
    const urlParams = new URLSearchParams(window.location.search)

    let redirect: string
    let appIDs: string[]

    if (urlParams.has("return") && urlParams.has("refs")) {
      redirect = urlParams.get("return")!
      appIDs = urlParams.get("refs")!.split(";")
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

    checkPurchasesPurchasesCheckPurchasesPost(appIDs, {
      withCredentials: true,
    })
      .then(() => {
        getUpdateTokenPurchasesGenerateUpdateTokenPost({
          withCredentials: true,
        })
          .then((result) =>
            fetch(
              redirect.toString() +
                "success?token=" +
                encodeURIComponent(result.data.token),
            ),
          )
          .then(() => {
            setPendingTransaction(null)
            router.push("/purchase/finished")
          })
          .catch(() => toast.error(t("app-install-error-try-again")))
      })
      .catch((err) => {
        console.log(err)
        switch (err.detail) {
          case "not_logged_in":
            setPendingTransaction({
              redirect,
              appIDs,
              missingAppIDs: [],
            })
            router.push("/login")
            break

          case "purchase_necessary":
            const missingAppIDs: string[] = err.headers["missing-appids"] // Todo check if this works

            setPendingTransaction({
              redirect,
              appIDs,
              missingAppIDs,
            })
            router.push("/purchase/checkout")
            break

          default:
            toast.error(t(err))
        }
      })
  }, [pendingTransaction, router, setPendingTransaction, t])

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <Spinner size="m" />
    </div>
  )
}
