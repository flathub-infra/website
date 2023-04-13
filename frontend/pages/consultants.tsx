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

        <h2>Hari Rana</h2>

        <p>
          Hari Rana is a Flatpak, GNOME and Fedora contributor; the
          co-maintainer of <a href="https://usebottles.com/">Bottles</a> and
          <a href="https://gitlab.com/TheEvilSkeleton/Upscaler">Upscaler</a>;
          and a member of <a href="https://vanillaos.org/">Vanilla OS</a>, a
          Flatpak-centric distribution. He maintains a number of apps on
          Flathub, including three Chromium-based web browsers. See
          <a href="https://theevilskeleton.gitlab.io/">his website</a> for more
          details and contact information.
        </p>

        <h2>Mazhar Hussain</h2>

        <p>
          Mazhar Hussain is the primary author of
          <a href="https://gdm-settings.github.io/">Login Manager Settings</a>,
          a settings app for GNOME's login manager, which is published on
          Flathub. See
          <a href="https://realmazharhussain.github.io/">his website</a> for
          more details and contact information.
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
