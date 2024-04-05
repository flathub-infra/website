import { useQuery } from "@tanstack/react-query"
import { GetStaticPaths, GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import AppDevelopersControls from "src/components/application/AppDevelopersControls"
import UploadTokenControls from "src/components/application/AppUploadControls/UploadTokenControls"
import * as AppVerificationControls from "src/components/application/AppVerificationControls"
import { AppDevModeration } from "src/components/moderation/AppDevModeration"
import { IS_PRODUCTION } from "src/env"
import * as AppVendingControls from "../../../../src/components/application/AppVendingControls"
import LoginGuard from "../../../../src/components/login/LoginGuard"
import { useUserContext } from "../../../../src/context/user-info"
import { fetchAppstream } from "../../../../src/fetchers"
import { Appstream } from "../../../../src/types/Appstream"
import { VendingConfig } from "../../../../src/types/Vending"
import DangerZoneControls from "src/components/application/DangerZoneControls"
import Breadcrumbs from "src/components/Breadcrumbs"
import Link from "next/link"
import { Disclosure, Transition } from "@headlessui/react"
import LogoImage from "src/components/LogoImage"
import { HiChevronUp } from "react-icons/hi2"
import { motion } from "framer-motion"
import { getInviteStatusInvitesAppIdGet } from "src/codegen"
import { getGlobalVendingConfigVendingConfigGet } from "src/codegen"
import { UserInfo } from "src/codegen/model/userInfo"

const SettingsDisclosure = ({ sectionTitle, children }) => {
  const variants = {
    open: { rotate: 0 },
    closed: { rotate: 180 },
  }

  return (
    <Disclosure as={"div"} className="pt-4">
      {({ open }) => (
        <>
          <Disclosure.Button className="w-full flex items-start justify-between">
            <div className="flex text-xl font-semibold gap-3">
              {sectionTitle}
            </div>
            <motion.span
              animate={open ? "open" : "closed"}
              variants={variants}
              className="ml-6 flex h-7 items-center"
            >
              <HiChevronUp className="h-6 w-6" aria-hidden="true" />
            </motion.span>
          </Disclosure.Button>
          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Disclosure.Panel className={"pt-6"}>{children}</Disclosure.Panel>
          </Transition>
        </>
      )}
    </Disclosure>
  )
}

export default function AppManagementPage({
  app,
  vendingConfig,
}: {
  app: Appstream
  vendingConfig: VendingConfig
}) {
  const { t } = useTranslation()
  const user = useUserContext()

  const pages = [
    { name: t("developer-portal"), current: false, href: "/developer-portal" },
    {
      name: t("manage-x", { "app-name": app.name }),
      current: true,
      href: `/apps/manage/${app.id}`,
    },
  ]

  const inviteQuery = useQuery({
    queryKey: ["invite-status", app.id],
    queryFn: () =>
      getInviteStatusInvitesAppIdGet(app.id, {
        withCredentials: true,
      }),
    enabled: !!app.id,
  })

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title={t(app.name)} noindex />
      <LoginGuard
        condition={(info: UserInfo) => info.dev_flatpaks.includes(app.id)}
      >
        <div className="space-y-8">
          <Breadcrumbs pages={pages} />
          <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
            <>
              <div className="space-y-12 w-full divide-y divide-flathub-gainsborow dark:divide-flathub-granite-gray">
                <Link
                  href={`/apps/${app.id}`}
                  className="no-underline hover:underline flex gap-3 items-center"
                >
                  <LogoImage iconUrl={app.icon} appName={app.name} size="64" />
                  <h1 className="text-4xl font-extrabold">{app.name}</h1>
                </Link>
                <div className="space-y-3  divide-y divide-flathub-gainsborow dark:divide-flathub-granite-gray">
                  <SettingsDisclosure sectionTitle={t("verification")}>
                    <AppVerificationControls.AppVerificationSetup
                      app={app}
                      isNewApp={false}
                      showHeader={false}
                    />
                  </SettingsDisclosure>
                  {(!IS_PRODUCTION || user.info?.is_moderator) && (
                    <>
                      <SettingsDisclosure sectionTitle={t("accepting-payment")}>
                        <AppVendingControls.SetupControls
                          app={app}
                          vendingConfig={vendingConfig}
                        />
                      </SettingsDisclosure>
                      <SettingsDisclosure sectionTitle={t("ownership-tokens")}>
                        <AppVendingControls.OwnershipTokens app={app} />
                      </SettingsDisclosure>
                    </>
                  )}
                  <SettingsDisclosure
                    sectionTitle={t("moderation-pending-reviews")}
                  >
                    <AppDevModeration appId={app.id} />
                  </SettingsDisclosure>

                  {(!IS_PRODUCTION || user.info?.is_moderator) && (
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

export const getStaticProps: GetStaticProps = async ({
  locale,
  params: { appId },
}) => {
  const [{ data: app }, { data: vendingConfig }] = await Promise.all([
    fetchAppstream(appId as string),
    getGlobalVendingConfigVendingConfigGet(),
  ])

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      app: app ?? { id: appId, name: appId },
      vendingConfig,
    },
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [],
    fallback: "blocking",
  }
}
