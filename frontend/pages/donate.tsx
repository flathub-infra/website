import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import DonationInput from "../src/components/payment/DonationInput"
import { Permission, UserInfo } from "src/codegen"
import clsx from "clsx"

export default function Donate() {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("donate-to", { project: "Flathub" })}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/donate`,
        }}
        noindex
      />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard
          condition={(info: UserInfo) =>
            info.permissions.some((a) => a === Permission.moderation)
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
                        📦 <strong>Software development</strong>: Cover the
                        costs of developing Flathub and related tools
                      </li>
                      <li>
                        🚀 <strong>Development</strong>: Support ongoing
                        development of Flatpak technology, enhancing its
                        features and expanding its reach
                      </li>
                      <li>
                        🔧 <strong>Portal development</strong>: Support the
                        creation and improvement of portals, which provide
                        secure, easy access to system services for Flatpak apps
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
        </LoginGuard>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
    revalidate: 900,
  }
}
