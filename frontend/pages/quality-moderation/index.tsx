import { useQuery } from "@tanstack/react-query"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"
import { ReactElement } from "react"
import { HiCheckCircle, HiExclamationTriangle } from "react-icons/hi2"
import Spinner from "src/components/Spinner"
import { useUserContext } from "src/context/user-info"
import { fetchQualityModerationDashboard } from "src/fetchers"

export default function QualityModerationDashboard() {
  const { t } = useTranslation()
  const user = useUserContext()

  const query = useQuery({
    queryKey: ["quality-moderation-dashboard"],
    queryFn: fetchQualityModerationDashboard,
    enabled: !!user.info?.["is-quality-moderator"],
  })

  let content: ReactElement

  if (!user.info || !user.info["is-quality-moderator"]) {
    content = (
      <>
        <h1 className="my-8">{t("whoops")}</h1>
        <p>{t("unauthorized-to-view")}</p>
        <Trans i18nKey={"common:retry-or-go-home"}>
          You might want to retry or go back{" "}
          <a className="no-underline hover:underline" href=".">
            home
          </a>
          .
        </Trans>
      </>
    )
  } else if (query.isLoading) {
    content = <Spinner size="m" />
  } else {
    content = (
      <>
        <h1 className="my-8 text-4xl font-extrabold">
          Quality Moderation Dashboard
        </h1>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mt-8 flow-root">
            <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead>
                    <tr>
                      <th
                        scope="col"
                        className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold sm:pl-0"
                      >
                        ID
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold"
                      >
                        Unrated
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold"
                      >
                        Not Passed
                      </th>
                      <th
                        scope="col"
                        className="px-3 py-3.5 text-left text-sm font-semibold"
                      >
                        Passed
                      </th>
                      <th
                        scope="col"
                        className="relative py-3.5 pl-3 pr-4 sm:pr-0"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {query.data.data.apps.map((app) => (
                      <tr key={app.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium sm:pl-0">
                          <Link href={`/apps/${app.id}`}>{app.id}</Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {app["quality-moderation-status"].unrated}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {app["quality-moderation-status"]["not-passed"]}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {app["quality-moderation-status"].passed}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                          {app["quality-moderation-status"].passes ? (
                            <HiCheckCircle className="w-6 h-6 text-flathub-celestial-blue" />
                          ) : (
                            <HiExclamationTriangle className="w-6 h-6 text-flathub-electric-red" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
      <NextSeo title="Quality Moderation Dashboard" />
      {content}
    </div>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale, params }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}
