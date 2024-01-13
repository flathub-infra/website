import { useMutation, useQuery } from "@tanstack/react-query"
import { useTranslation } from "next-i18next"
import { FunctionComponent, useState } from "react"
import { toast } from "react-toastify"
import Button from "../Button"
import Spinner from "../Spinner"
import { vendingApi } from "src/api"

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
  const statusQuery = useQuery({
    queryKey: ["/vending/status"],
    queryFn: () =>
      vendingApi.statusVendingStatusGet({
        withCredentials: true,
      }),
  })

  // Dashboard is accessible as soon as onboarding is submit
  const dashboardQuery = useQuery({
    queryKey: ["/vending/status/dashboardlink"],
    queryFn: () =>
      vendingApi.getDashboardLinkVendingStatusDashboardlinkGet({
        withCredentials: true,
      }),

    enabled: statusQuery.isSuccess && statusQuery.data.data.details_submitted,
  })

  const generateOnboardingLinkMutation = useMutation({
    mutationFn: () =>
      vendingApi.startOnboardingVendingStatusOnboardingPost(
        {
          return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/my-flathub`,
        },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (data) => {
      setOnboarding(true)
      window.location.href = data.data.target_url
    },
    onError: (error) => {
      toast.error(t(error.message))
      setOnboarding(false)
    },
  })

  if (
    statusQuery.isPending ||
    dashboardQuery.isLoading ||
    // If onboarding used, show loading until redirected
    onboarding
  ) {
    return <Spinner size="s" />
  }

  if (statusQuery.isError || dashboardQuery.isError) {
    return (
      <p className="m-0">
        {t(statusQuery.error.message || dashboardQuery.error.message)}
      </p>
    )
  }

  // No status when onboarding hasn't begun
  if (!statusQuery.data.data || !statusQuery.data.data.details_submitted) {
    return (
      <Button
        variant="primary"
        onClick={() => {
          if (onboarding) return

          generateOnboardingLinkMutation.mutate()
        }}
      >
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
        href={dashboardQuery.data.data.target_url}
      >
        {t("vending-dashboard")}
      </a>
      {statusQuery.data.data.needs_attention ? (
        <p className="m-0 text-red-600">{t("requires-attention")}</p>
      ) : (
        <></>
      )}
    </div>
  )
}

export default VendingLink
