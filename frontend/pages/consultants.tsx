import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import { fetchStats } from "../src/fetchers"

const Consultants = (): JSX.Element => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("consultants")}
        description={t("consultants-description")}
      />
      <div className="prose flex max-w-full flex-col px-[5%] text-justify dark:prose-invert md:px-[20%] 2xl:px-[30%]">
        <h1 className="my-8">Consultants and Contractors</h1>

        <p>
          Developers who are interested in publishing their app on Flathub may
          want some technical assistance with the process of preparing and
          submitting their app to Flathub. Below, we have some companies and
          individuals that offer consulting services for preparing a Flatpak
          build of an app and submitting it to Flathub. Typically, they would
          support the submission of an app which already has a working Linux
          version.
        </p>

        <p>
          All companies and individuals listed below are familiar to the Flathub
          team, have successfully submitted at least one app to Flathub, and
          actively maintain at least one app on Flathub. Beyond this,
          <strong>the Flathub team has done no checks on them</strong>. Please
          contact them directly if you would like to know more about the
          services that they provide.
        </p>

        <h2>Flatty McPakface, LLC</h2>

        <p>
          Flatty McPakface is a boutique software consultancy, based on the
          Great Pacific Garbage Patch. As well as maintaining Poorly-Planned
          Audience Polls on Flathub, we have contributed a number of features to
          Flatpak itself, including the recycling portal.
        </p>

        <p>
          <a href="https://flattymcpakface.example.com/">More details</a>
        </p>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  console.log("Fetching data for stats")
  const stats = await fetchStats()

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      stats,
    },
    revalidate: 900,
  }
}

export default Consultants
