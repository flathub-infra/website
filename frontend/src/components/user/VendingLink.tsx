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
        withCredentials: true,
      }),
  })

  // Dashboard is accessible as soon as onboarding is submit
  const dashboardQuery = useQuery({
    queryKey: ["/vending/status/dashboardlink"],
    queryFn: () =>
      getDashboardLinkVendingStatusDashboardlinkGet({
        withCredentials: true,
      }),

    enabled:
      statusQuery.isSuccess &&
      !!statusQuery.data.data &&
      statusQuery.data.data.details_submitted,
  })

  const generateOnboardingLinkMutation = useMutation({
    mutationFn: () =>
      startOnboardingVendingStatusOnboardingPost(
        {
          return_url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/developer-portal`,
        },
        {
          withCredentials: true,
        },
      ),
    onSuccess: (data) => {
      setOnboarding(true)
      push(data.data.target_url)
    },
    onError: (error) => {
      toast.error(t(error.message))
      setOnboarding(false)
    },
  })

  if (statusQuery.isPending || dashboardQuery.isLoading) {
    return (
      <div className="flex justify-center">
        <Spinner size="s" />
      </div>
    )
  }

  if (statusQuery.isError || dashboardQuery.isError) {
    const errorMessage =
      statusQuery.error?.message || dashboardQuery.error?.message
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3">
        <p className="m-0 text-sm text-red-800 dark:text-red-200">
          {t(errorMessage)}
        </p>
      </div>
    )
  }

  // No status when onboarding hasn't begun
  if (!statusQuery.data.data || !statusQuery.data.data.details_submitted) {
    const isLoading = generateOnboardingLinkMutation.isPending || onboarding
    return (
      <Button
        size="lg"
        disabled={isLoading}
        onClick={() => {
          generateOnboardingLinkMutation.mutate()
        }}
      >
        {isLoading ? t("loading") : t("vending-onboard")}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        target="_blank"
        rel="noreferrer"
        className="no-underline hover:underline text-flathub-celestial-blue font-medium"
        href={dashboardQuery.data.data.target_url}
      >
        {t("vending-dashboard")}
      </a>
      {statusQuery.data.data.needs_attention && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 border-l-4 border-amber-500 dark:border-amber-400">
          <p className="m-0 text-sm font-medium text-amber-800 dark:text-amber-200">
            {t("requires-attention")}
          </p>
        </div>
      )}
    </div>
  )
}

export default VendingLink
