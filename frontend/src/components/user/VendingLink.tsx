import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "next-i18next"
import { FunctionComponent, useCallback, useState } from "react"
import { toast } from "react-toastify"
import { VendingStatus } from "src/types/Vending"
import {
  getDashboardLink,
  getOnboardingLink,
  getVendingStatus,
} from "../../asyncs/vending"
import Button from "../Button"
import Spinner from "../Spinner"

/**
 * A link to the user's account for donations and payments. Will be one of:
 *
 * - Onboarding button
 * - Dashboard link (possibly with "attention needed" text)
 */
const VendingLink: FunctionComponent = () => {
  const { t } = useTranslation()
  const [onboarding, setOnboarding] = useState(false)

  // Serial queries needed to get the right vending link
  // First check the user's existing status
  const statusQuery = useQuery<VendingStatus, string>({
    queryKey: ["/vending/status"],
    queryFn: getVendingStatus,
  })

  // Dashboard is accessible as soon as onboarding is submit
  const dashboardQuery = useQuery<string, string>({
    queryKey: ["/vending/status/dashboardlink"],
    queryFn: getDashboardLink,
    enabled: statusQuery.isSuccess && statusQuery.data.details_submitted,
  })

  // Otherwise onboarding required still
  // Can't pre-fetch link, it will create an account without user action
  const startOnboard = useCallback(async () => {
    if (onboarding) return

    try {
      setOnboarding(true)
      const url = await getOnboardingLink()
      window.location.href = url
    } catch (error) {
      toast.error(t(error))
      setOnboarding(false)
    }
  }, [onboarding, t])

  if (
    statusQuery.isLoading ||
    dashboardQuery.isInitialLoading ||
    // If onboarding used, show loading until redirected
    onboarding
  ) {
    return <Spinner size="s" />
  }

  if (statusQuery.isError || dashboardQuery.isError) {
    return <p className="m-0">{t(statusQuery.error || dashboardQuery.error)}</p>
  }

  // No status when onboarding hasn't begun
  if (!statusQuery.data || !statusQuery.data.details_submitted) {
    return (
      <Button variant="primary" onClick={startOnboard}>
        {t("vending-onboard")}
      </Button>
    )
  }

  return (
    <div className="flex- flex-col">
      <a
        target="_blank"
        rel="noreferrer"
        className="no-underline hover:underline"
        href={dashboardQuery.data}
      >
        {t("vending-dashboard")}
      </a>
      {statusQuery.data.needs_attention ? (
        <p className="m-0 text-red-600">{t("requires-attention")}</p>
      ) : (
        <></>
      )}
    </div>
  )
}

export default VendingLink
