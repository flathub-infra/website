"use client"

import { useTranslations } from "next-intl"
import { type ReactNode } from "react"
import { GitBranch } from "lucide-react"
import { Link } from "src/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AppMaintenance from "src/components/application/AppMaintenance"
import AppDevelopersControls from "src/components/application/AppDevelopersControls"
import UploadTokenControls from "src/components/application/AppUploadControls/UploadTokenControls"
import * as AppVerificationControls from "src/components/application/AppVerificationControls"
import { AppDevModeration } from "src/components/moderation/AppDevModeration"
import { IS_PRODUCTION } from "src/env"
import * as AppVendingControls from "src/components/application/AppVendingControls"
import LoginGuard from "src/components/login/LoginGuard"
import { useUserContext } from "src/context/user-info"
import DangerZoneControls from "src/components/application/DangerZoneControls"
import Breadcrumbs from "src/components/Breadcrumbs"
import LogoImage from "src/components/LogoImage"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
  VendingConfig,
  useGetAppVendingSetupVendingappAppIdSetupGet,
  useGetInviteStatusInvitesAppIdGet,
  GetAppstreamAppstreamAppIdGet200,
} from "src/codegen"

interface Props {
  app: Pick<
    GetAppstreamAppstreamAppIdGet200,
    "id" | "name" | "bundle" | "type" | "icon" | "metadata"
  >
  vendingConfig: VendingConfig
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
      className="mt-0 min-w-0 pt-0 data-[state=inactive]:hidden"
    >
      <h2 className="mb-5 text-2xl font-bold tracking-tight">{title}</h2>
      {children}
    </TabsContent>
  )
}

export default function ManageClient({ app, vendingConfig }: Props) {
  const t = useTranslations()
  const user = useUserContext()
  const isAnApp = [
    "desktop",
    "console-application",
    "desktop-application",
  ].includes(app.type)
  const canManagePayments =
    isAnApp &&
    (!IS_PRODUCTION || user.info?.permissions?.includes(Permission.moderation))
  const canManageUploads =
    (isAnApp || app.type === "runtime") &&
    (!IS_PRODUCTION ||
      user.info?.permissions?.includes(Permission["direct-upload"]))

  const query = useGetAppVendingSetupVendingappAppIdSetupGet(app.id, {
    query: { enabled: !!app.id && canManagePayments },
    axios: { withCredentials: true },
  })
  const inviteQuery = useGetInviteStatusInvitesAppIdGet(app.id, {
    axios: { withCredentials: true },
    query: { enabled: !!app.id },
  })
  const isDirectUpload = inviteQuery.isSuccess
    ? inviteQuery.data.data.is_direct_upload_app
    : undefined
  const sections = [
    {
      value: "reviews",
      title: t("app-management.reviews"),
      content: <AppDevModeration appId={app.id} />,
    },
    ...(isAnApp
      ? [
          {
            value: "verification",
            title: t("verification"),
            content: (
              <AppVerificationControls.AppVerificationSetup
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
            title: t("accepting-payment"),
            content: (
              <AppVendingControls.SetupControls
                app={app}
                vendingConfig={vendingConfig}
              />
            ),
          },
        ]
      : []),
    ...(canManagePayments &&
    query.isSuccess &&
    query.data?.data?.status === "ok"
      ? [
          {
            value: "ownership",
            title: t("ownership-tokens"),
            content: <AppVendingControls.OwnershipTokens app={app} />,
          },
        ]
      : []),
    ...(canManageUploads && isDirectUpload
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
            title: t("upload-tokens"),
            content: <UploadTokenControls app={app} />,
          },
        ]
      : []),
    ...(canManageUploads && isAnApp
      ? [
          {
            value: "danger",
            title: t("danger-zone"),
            content: <DangerZoneControls app={app} />,
          },
        ]
      : []),
  ]
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
    <div className="mx-auto mb-16 mt-6 w-11/12 max-w-[1400px] [--muted-foreground:var(--flathub-granite-gray)] [--primary:var(--flathub-celestial-blue-dark)] dark:[--muted-foreground:var(--flathub-gray-x11)] dark:[--primary:var(--flathub-celestial-blue-light)] dark:[--primary-foreground:var(--flathub-dark-gunmetal)] [&_p]:mb-0 [&_p_a:not([data-slot=button])]:text-foreground [&_p_a:not([data-slot=button])]:underline [&_p_a:not([data-slot=button])]:underline-offset-[3px]">
      <LoginGuard
        condition={(info: GetUserinfoAuthUserinfoGet200) =>
          info.dev_flatpaks?.includes(app.id)
        }
      >
        <Breadcrumbs pages={pages} />
        <header className="flex flex-wrap items-center justify-between gap-5 py-6">
          <div className="flex min-w-0 items-center gap-5">
            <div className="grid shrink-0 place-items-center">
              <LogoImage iconUrl={app.icon} appName={app.name} size={64} />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
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

        {isAnApp ? (
          <section
            aria-labelledby="maintenance-heading"
            className="mb-8 rounded-xl bg-flathub-white p-[clamp(18px,2.5vw,28px)] shadow-md dark:bg-flathub-arsenic"
          >
            <h2
              id="maintenance-heading"
              className="mb-5 text-2xl font-bold tracking-tight"
            >
              {t("app-maintenance.title")}
            </h2>
            <AppMaintenance
              appId={app.id}
              manifestUrl={app.metadata?.["flathub::manifest"]}
            />
          </section>
        ) : (
          <div className="mb-8">
            <Button asChild variant="secondary">
              <Link href={`/builds/apps/${app.id}`}>
                <GitBranch data-icon="inline-start" aria-hidden />
                {t("view-builds")}
              </Link>
            </Button>
          </div>
        )}

        <Tabs
          defaultValue="reviews"
          orientation="vertical"
          className="grid items-start gap-8 md:grid-cols-[190px_minmax(0,1fr)] xl:gap-12"
        >
          <nav aria-label={t("app-management.sections")} className="min-w-0">
            <div className="mb-4 flex items-center gap-3 text-sm font-semibold leading-[1.6] text-muted-foreground">
              {t("manage")}
            </div>
            <TabsList
              aria-label={t("app-management.sections")}
              variant="rail"
              className="grid w-full grid-cols-2 md:grid-cols-1"
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
          <div className="min-w-0 rounded-xl bg-flathub-white p-[clamp(18px,2.5vw,28px)] shadow-md dark:bg-flathub-arsenic">
            {sections.map(({ value, title, content }) => (
              <ManagementPanel key={value} value={value} title={title}>
                {content}
              </ManagementPanel>
            ))}
          </div>
        </Tabs>
      </LoginGuard>
    </div>
  )
}
