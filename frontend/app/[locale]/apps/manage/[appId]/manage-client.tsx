"use client"

import { useFormatter, useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import { useState, type ReactNode } from "react"
import { Link } from "src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AppMaintenance, {
  AppRuntimeWarning,
} from "src/components/application/AppMaintenance"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AppDevModeration } from "src/components/moderation/AppDevModeration"
import { IS_PRODUCTION } from "src/env"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserContext } from "src/context/user-info"
import Spinner from "src/components/Spinner"
import Breadcrumbs from "src/components/Breadcrumbs"
import LogoImage from "src/components/LogoImage"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
  useGetGlobalVendingConfigVendingConfigGet,
  useGetInviteStatusInvitesAppIdGet,
  GetAppstreamAppstreamAppIdGet200,
  type VendingSetup,
} from "src/codegen"
import { useManagementSetup } from "src/components/application/AppVendingControls/useManagementSetup"

const UploadTokenControls = dynamic(
  () =>
    import("src/components/application/AppUploadControls/UploadTokenControls"),
)
const VerificationSetup = dynamic(
  () =>
    import("src/components/application/AppVerificationControls/AppVerificationSetup"),
)
const DangerZoneControls = dynamic(
  () => import("src/components/application/DangerZoneControls"),
)
const SetupControls = dynamic(
  () => import("src/components/application/AppVendingControls/SetupControls"),
)
const OwnershipTokens = dynamic(
  () =>
    import("src/components/application/AppVendingControls/OwnershipTokens/TokenList"),
)
const AppDevelopersControls = dynamic(
  () => import("src/components/application/AppDevelopersControls"),
)

interface Props {
  app: Pick<
    GetAppstreamAppstreamAppIdGet200,
    "id" | "name" | "bundle" | "type" | "icon" | "metadata"
  >
}

function EditablePaymentsPanel({ app }: Props) {
  const t = useTranslations()
  const config = useGetGlobalVendingConfigVendingConfigGet()
  if (config.isPending) {
    return <Spinner size="m" />
  }
  if (!config.data) {
    return <p role="alert">{t("failed-to-load-refresh")}</p>
  }
  return <SetupControls app={app} vendingConfig={config.data.data} />
}

function PaymentsPanel({
  app,
  setup,
  isDeveloper,
}: Props & { setup?: VendingSetup; isDeveloper: boolean }) {
  const t = useTranslations()
  if (!setup) {
    return <p role="alert">{t("failed-to-load-refresh")}</p>
  }
  if (isDeveloper && (setup.status === "no-config" || setup.is_owner)) {
    return <EditablePaymentsPanel app={app} />
  }
  return <PaymentSummary setup={setup} />
}

function PaymentSummary({ setup }: { setup: VendingSetup }) {
  const t = useTranslations()
  const format = useFormatter()
  if (setup.status === "no-config") {
    return <p>{t("app-management.payments-not-configured")}</p>
  }
  const amount = (cents: number) =>
    format.number(cents / 100, { style: "currency", currency: setup.currency })
  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt>{t("recommended-payment")}</dt>
        <dd>{amount(setup.recommended_donation)}</dd>
        <dt>{t("minimum-payment")}</dt>
        <dd>{amount(setup.minimum_payment)}</dd>
      </dl>
      <p className="mt-2">
        {t("app-management.app-share-after-fees", {
          percentage: format.number(setup.appshare / 100, { style: "percent" }),
        })}
      </p>
    </>
  )
}

function ManagementPanel({
  value,
  title,
  children,
}: {
  value: string
  title: string
  children: ReactNode
}) {
  return (
    <TabsContent
      value={value}
      forceMount
      className="mt-0 min-w-0 rounded-xl bg-flathub-white p-[clamp(18px,2.5vw,28px)] shadow-sm dark:bg-flathub-arsenic data-[state=inactive]:hidden data-[reviews=true]:bg-transparent data-[reviews=true]:p-0 data-[reviews=true]:shadow-none dark:data-[reviews=true]:bg-transparent"
      data-reviews={value === "reviews"}
    >
      {value !== "uploads" && (
        <h2 className="mb-6 text-xl font-semibold tracking-tight">{title}</h2>
      )}
      {children}
    </TabsContent>
  )
}

export default function ManageClient({ app }: Props) {
  const t = useTranslations()
  const user = useUserContext()
  const canManageAllApps = user.info?.permissions?.includes(
    Permission["manage-apps"],
  )
  const isDeveloper = user.info?.dev_flatpaks?.includes(app.id)
  const [selectedSection, setSelectedSection] = useState("reviews")
  const [visitedSections, setVisitedSections] = useState(
    () => new Set(["reviews"]),
  )
  function selectSection(section: string) {
    setVisitedSections((previous) =>
      previous.has(section) ? previous : new Set(previous).add(section),
    )
    setSelectedSection(section)
  }
  const isAnApp = [
    "desktop",
    "console-application",
    "desktop-application",
  ].includes(app.type)
  // SDK extensions can be represented by AppStream as add-ons, not runtimes.
  const canViewMaintenance =
    isAnApp || app.type === "runtime" || app.type === "addon"
  const canManagePayments =
    isAnApp &&
    (!IS_PRODUCTION ||
      canManageAllApps ||
      user.info?.permissions?.includes(Permission.moderation))
  const canManageUploads =
    (isAnApp || app.type === "runtime") &&
    (!IS_PRODUCTION ||
      canManageAllApps ||
      user.info?.permissions?.includes(Permission["direct-upload"]))

  const canAccessApp = !!app.id && !!(isDeveloper || canManageAllApps)
  const invite = useGetInviteStatusInvitesAppIdGet(app.id, {
    axios: { withCredentials: true },
    query: { enabled: canAccessApp && !!canManageUploads },
  })
  const setup = useManagementSetup(app.id, canAccessApp && !!canManagePayments)

  const sections = [
    {
      value: "reviews",
      title: t("app-management.reviews"),
      content: <AppDevModeration appId={app.id} />,
    },
    ...(canViewMaintenance
      ? [
          {
            value: "maintenance",
            title: t("app-maintenance.title"),
            content: (
              <AppMaintenance
                appId={app.id}
                manifestUrl={app.metadata?.["flathub::manifest"]}
              />
            ),
          },
        ]
      : []),
    ...(isAnApp
      ? [
          {
            value: "verification",
            title: t("verification"),
            content: (
              <VerificationSetup
                app={app}
                isNewApp={false}
                showHeader={false}
              />
            ),
          },
        ]
      : []),
    ...(canManagePayments
      ? [
          {
            value: "payment",
            title: t("app-management.payments"),
            content: setup.isPending ? (
              <Spinner size="m" />
            ) : (
              <PaymentsPanel
                app={app}
                setup={setup.data?.data}
                isDeveloper={!!isDeveloper}
              />
            ),
          },
        ]
      : []),
    ...(canManagePayments && setup.isSuccess && setup.data.data.status === "ok"
      ? [
          {
            value: "ownership",
            title: t("ownership-tokens"),
            content: (
              <OwnershipTokens
                app={app}
                canManage={setup.data.data.is_owner === true}
              />
            ),
          },
        ]
      : []),
    ...(canManageUploads &&
    invite.isSuccess &&
    invite.data.data.is_direct_upload_app
      ? [
          {
            value: "developers",
            title: t("developers"),
            content: <AppDevelopersControls app={app} />,
          },
        ]
      : []),
    ...(canManageUploads
      ? [
          {
            value: "uploads",
            title: t("app-management.uploads"),
            content: <UploadTokenControls app={app} />,
          },
        ]
      : []),
    ...(canManageUploads && isAnApp
      ? [
          {
            value: "danger",
            title: t("danger-zone"),
            content: <DangerZoneControls app={app} canModify={!!isDeveloper} />,
          },
        ]
      : []),
  ]
  const activeSection = sections.some(
    (section) => section.value === selectedSection,
  )
    ? selectedSection
    : "reviews"
  const pages = [
    {
      name: t("developer-portal.title"),
      current: false,
      href: "/developer-portal",
    },
    {
      name: t("manage-x", { app_name: app.name }),
      current: true,
      href: `/apps/manage/${app.id}`,
    },
  ]

  return (
    <div className="mx-auto mb-16 mt-6 w-11/12 max-w-[1200px] [--muted-foreground:var(--flathub-granite-gray)] [--primary:var(--flathub-celestial-blue-dark)] dark:[--muted-foreground:var(--flathub-gray-x11)] dark:[--primary:var(--flathub-celestial-blue-light)] dark:[--primary-foreground:var(--flathub-dark-gunmetal)] [&_p]:mb-0 [&_p_a:not([data-slot=button])]:text-foreground [&_p_a:not([data-slot=button])]:underline [&_p_a:not([data-slot=button])]:underline-offset-[3px]">
      <LoginGuard
        condition={(info: GetUserinfoAuthUserinfoGet200) =>
          info.dev_flatpaks?.includes(app.id) ||
          info.permissions?.includes(Permission["manage-apps"])
        }
      >
        <Breadcrumbs pages={pages} />
        <header className="flex flex-wrap items-center justify-between gap-5 py-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="grid shrink-0 place-items-center">
              <LogoImage iconUrl={app.icon} appName={app.name} size={64} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
                {app.name}
              </h1>
              <p
                className="mt-2 break-all font-mono text-xs text-muted-foreground"
                dir="ltr"
              >
                {app.id}
              </p>
            </div>
          </div>
          <Button
            asChild
            variant="outline"
            className="relative shrink-0 text-foreground"
          >
            <Link href={`/apps/${app.id}`}>
              {t("app-management.view-listing")}
            </Link>
          </Button>
        </header>

        {isAnApp && activeSection !== "maintenance" && (
          <AppRuntimeWarning appId={app.id} />
        )}

        <Tabs
          value={activeSection}
          onValueChange={selectSection}
          orientation="vertical"
          className="grid items-start gap-4 md:min-h-[34rem] md:grid-cols-[190px_minmax(0,1fr)] md:gap-8"
        >
          <nav aria-label={t("app-management.sections")} className="min-w-0">
            <div className="mb-4 hidden items-center gap-3 text-xs font-semibold leading-[1.6] text-muted-foreground md:flex">
              {t("manage")}
            </div>
            <div className="md:hidden">
              <label
                htmlFor="management-section"
                className="mb-2 block text-xs font-semibold text-muted-foreground"
              >
                {t("app-management.manage-app")}
              </label>
              <Select value={activeSection} onValueChange={selectSection}>
                <SelectTrigger
                  id="management-section"
                  className="w-full data-[size=default]:h-11"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sections.map(({ value, title }) => (
                      <SelectItem
                        key={value}
                        value={value}
                        className="min-h-11"
                      >
                        {title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <TabsList
              aria-label={t("app-management.sections")}
              variant="rail"
              className="hidden w-full md:grid md:grid-cols-1"
            >
              {sections.map(({ value, title }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  variant="rail"
                  className="rounded-e-lg data-[state=active]:bg-flathub-gainsborow data-[state=active]:font-semibold dark:data-[state=active]:bg-flathub-arsenic"
                >
                  {title}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
          <div className="min-w-0">
            {sections.map(({ value, title, content }) => (
              <ManagementPanel key={value} value={value} title={title}>
                {visitedSections.has(value) && content}
              </ManagementPanel>
            ))}
          </div>
        </Tabs>
      </LoginGuard>
    </div>
  )
}
