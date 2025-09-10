import { useMutation, useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { FunctionComponent, useState } from "react"
import { toast } from "sonner"
import Spinner from "../Spinner"
import {
  getDashboardLinkVendingStatusDashboardlinkGet,
  startOnboardingVendingStatusOnboardingPost,
  statusVendingStatusGet,
} from "src/codegen"
import { Button } from "@/components/ui/button"
import { useRouter } from "src/i18n/navigation"

/**
 * A link to the user's account for donations and payments. Will be one of:
 *
 * - Onboarding button
 * - Dashboard link (possibly with "attention needed" text)
 */
const VendingLink: FunctionComponent = () => {
  const t = useTranslations()
  const [onboarding, setOnboarding] = useState(false)
  const { push } = useRouter()

  // Serial queries needed to get the right vending link
  // First check the user's existing status
  const statusQuery = useQuery({
    queryKey: ["/vending/status"],
    queryFn: () =>
      statusVendingStatusGet({
        credentials: "include",
      }),
  })

  // Dashboard is accessible as soon as onboarding is submit
  const dashboardQuery = useQuery({
    queryKey: ["/vending/status/dashboardlink"],
    queryFn: () =>
      getDashboardLinkVendingStatusDashboardlinkGet({
        credentials: "include",
      }),

    enabled: statusQuery.isSuccess && statusQuery.data.data.details_submitted,
  })

  const generateOnboardingLinkMutation = useMutation({
    mutationFn: () =>
      startOnboardingVendingStatusOnboardingPost(
        {
          return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/developer-portal`,
        },
        {
          credentials: "include",
        },
      ),
    onSuccess: (data) => {
      if (data.status === 200) {
        setOnboarding(true)
        push(data.data.target_url)
      }
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
        size="lg"
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
