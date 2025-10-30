"use client"

import { useTranslations } from "next-intl"
import { Link } from "src/i18n/navigation"
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Transition,
} from "@headlessui/react"
import { motion } from "framer-motion"
import { ChevronUpIcon } from "@heroicons/react/24/solid"

import AppDevelopersControls from "../../../../../src/components/application/AppDevelopersControls"
import UploadTokenControls from "../../../../../src/components/application/AppUploadControls/UploadTokenControls"
import * as AppVerificationControls from "../../../../../src/components/application/AppVerificationControls"
import { AppDevModeration } from "../../../../../src/components/moderation/AppDevModeration"
import { IS_PRODUCTION } from "../../../../../src/env"
import * as AppVendingControls from "../../../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../../../src/context/user-info"
import DangerZoneControls from "../../../../../src/components/application/DangerZoneControls"
import Breadcrumbs from "../../../../../src/components/Breadcrumbs"
import LogoImage from "../../../../../src/components/LogoImage"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
  VendingConfig,
  useGetAppVendingSetupVendingappAppIdSetupGet,
  useGetInviteStatusInvitesAppIdGet,
  GetAppstreamAppstreamAppIdGet200,
} from "../../../../../src/codegen"

interface Props {
  app: Pick<
    GetAppstreamAppstreamAppIdGet200,
    "id" | "name" | "bundle" | "type" | "icon"
  >
  vendingConfig: VendingConfig
}

const SettingsDisclosure = ({ sectionTitle, children }) => {
  const variants = {
    open: { rotate: 0 },
    closed: { rotate: 180 },
  }

  return (
    <Disclosure as={"div"} className="pt-4" defaultOpen>
      {({ open }) => (
        <>
          <DisclosureButton className="w-full flex items-start justify-between">
            <div className="flex text-xl font-semibold gap-3">
              {sectionTitle}
            </div>
            <motion.span
              animate={open ? "open" : "closed"}
              variants={variants}
              className="ms-6 flex h-7 items-center"
            >
              <ChevronUpIcon className="size-6" aria-hidden="true" />
            </motion.span>
          </DisclosureButton>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <DisclosurePanel className={"pt-6"}>{children}</DisclosurePanel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

export default function ManageClient({ app, vendingConfig }: Props) {
  const t = useTranslations()
  const user = useUserContext()

  const query = useGetAppVendingSetupVendingappAppIdSetupGet(app.id, {
    query: { enabled: !!app.id },
    axios: { withCredentials: true },
  })

  const isAnApp = [
    "desktop",
    "console-application",
    "desktop-application",
  ].includes(app.type)

  const pages = [
    { name: t("developer-portal"), current: false, href: "/developer-portal" },
    {
      name: t("manage-x", { app_name: app.name }),
      current: true,
      href: `/apps/manage/${app.id}`,
    },
  ]

  const inviteQuery = useGetInviteStatusInvitesAppIdGet(app.id, {
    axios: { withCredentials: true },
    query: { enabled: !!app.id },
  })

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <LoginGuard
        condition={(info: GetUserinfoAuthUserinfoGet200) =>
          info.dev_flatpaks?.includes(app.id)
        }
      >
        <div className="space-y-8">
          <Breadcrumbs pages={pages} />
          <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
            <>
              <div className="w-full">
                <Link
                  href={`/apps/${app.id}`}
                  className="no-underline hover:underline flex gap-3 items-center"
                >
                  <LogoImage iconUrl={app.icon} appName={app.name} size="64" />
                  <h1 className="text-4xl font-extrabold">{app.name}</h1>
                </Link>
                <div className="*:py-3 divide-y divide-flathub-gainsborow dark:divide-flathub-granite-gray">
                  {isAnApp && (
                    <SettingsDisclosure sectionTitle={t("verification")}>
                      <AppVerificationControls.AppVerificationSetup
                        app={app}
                        isNewApp={false}
                        showHeader={false}
                      />
                    </SettingsDisclosure>
                  )}
                  {(!IS_PRODUCTION ||
                    user.info?.permissions?.some(
                      (a) => a === Permission.moderation,
                    )) &&
                    isAnApp && (
                      <>
                        <SettingsDisclosure
                          sectionTitle={t("accepting-payment")}
                        >
                          <AppVendingControls.SetupControls
                            app={app}
                            vendingConfig={vendingConfig}
                          />
                        </SettingsDisclosure>
                        {query.isSuccess &&
                          query.data?.data?.status === "ok" && (
                            <SettingsDisclosure
                              sectionTitle={t("ownership-tokens")}
                            >
                              <AppVendingControls.OwnershipTokens app={app} />
                            </SettingsDisclosure>
                          )}
                      </>
                    )}
                  <SettingsDisclosure
                    sectionTitle={t("moderation-pending-reviews")}
                  >
                    <AppDevModeration appId={app.id} />
                  </SettingsDisclosure>

                  {(!IS_PRODUCTION ||
                    user.info?.permissions?.some(
                      (a) => a === Permission["direct-upload"],
                    )) &&
                    isAnApp && (
                      <>
                        {inviteQuery.data?.data?.is_direct_upload_app && (
                          <SettingsDisclosure sectionTitle={t("developers")}>
                            <AppDevelopersControls app={app} />
                          </SettingsDisclosure>
                        )}
                        <SettingsDisclosure sectionTitle={t("upload-tokens")}>
                          <UploadTokenControls app={app} />
                        </SettingsDisclosure>
                        <SettingsDisclosure sectionTitle={t("danger-zone")}>
                          <DangerZoneControls app={app} />
                        </SettingsDisclosure>
                      </>
                    )}
                </div>
              </div>
            </>
          </div>
        </div>
      </LoginGuard>
    </div>
  )
}
