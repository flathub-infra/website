"use client"

import { useTranslations } from "next-intl"
import ClientAuthGuard from "../../../../src/components/login/ClientAuthGuard"
import DonationInput from "../../../../src/components/payment/DonationInput"
import {
  Permission,
  GetUserinfoAuthUserinfoGet200,
} from "../../../../src/codegen"
import clsx from "clsx"
import type { JSX } from "react"

const DonateClient = (): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <ClientAuthGuard
        condition={(info: GetUserinfoAuthUserinfoGet200) =>
          info.permissions.some((a) => a === Permission.moderation) ||
          process.env.NODE_ENV === "development"
        }
      >
        <h1 className="pt-12 text-4xl font-extrabold">
          {t("donate-to", { project: "Flathub" })}
        </h1>
        <div
          className={clsx(
            "grid grid-cols-1 gap-x-8 gap-y-5 lg:mx-0 lg:max-w-none lg:grid-cols-3",
          )}
        >
          <div className="col-span-1 lg:col-span-2 mx-0 mt-5 rounded-xl bg-flathub-white p-5 dark:bg-flathub-arsenic">
            <div className="prose dark:prose-invert">
              {/* TODO: Translatie this */}
              <ul>
                <li>
                  🌐 <strong>Flathub welcomes your donations</strong>: Your
                  support helps maintain the app repository for Flatpak
                  applications and keeps its vital infrastructure in top shape
                </li>
                <li>
                  💰 <strong>Where your funds go</strong>:
                  <ul>
                    <li>
                      🌐 <strong>Infrastructure</strong>: Keep the platform
                      running smoothly
                    </li>
                    <li>
                      💻 <strong>Hosting services</strong>: Cover the costs of
                      keeping everything online and accessible
                    </li>
                    <li>
                      📦 <strong>Software development</strong>: Cover the costs
                      of developing Flathub and related tools
                    </li>
                    <li>
                      🚀 <strong>Development</strong>: Support ongoing
                      development of Flatpak technology, enhancing its features
                      and expanding its reach
                    </li>
                    <li>
                      🔧 <strong>Portal development</strong>: Support the
                      creation and improvement of portals, which provide secure,
                      easy access to system services for Flatpak apps
                    </li>
                  </ul>
                </li>
                <li>
                  🌟 <strong>Your impact</strong>: Every contribution helps
                  create a robust and diverse ecosystem of apps for all Linux
                  users
                </li>
              </ul>
              <div>
                <strong>Your support makes a difference!</strong> 🙌
              </div>
            </div>
          </div>
          <DonationInput org="org.flathub.Flathub" />
        </div>
      </ClientAuthGuard>
    </div>
  )
}

export default DonateClient
