import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"

const About = () => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo title={t("about")} description={t("about-description")} />
      <div className="flex flex-col">
        {/* <!-- header --> */}
        <header
          className={`flex bg-colorPrimary bg-none bg-contain bg-no-repeat px-[5%] md:px-[20%] lg:bg-[url('/img/about.svg')] 2xl:px-[30%]`}
        >
          <div>
            <h1>{t("about-pagename")}</h1>
            <Trans i18nKey={"common:about-block"}>
              <p className="mb-12 text-lg">
                Flathub aims to be the place to get and distribute apps for
                Linux. It is powered by
                <a
                  className="font-bold text-gray-400 opacity-80 duration-200"
                  href="https://flatpak.org"
                >
                  Flatpak
                </a>{" "}
                which allows Flathub apps to run on almost any Linux
                distribution.
              </p>

              <p className="mb-12 text-lg">
                If you are a Linux user, you can use Flathub to gain access to a
                growing collection of Flatpak applications. You just need to
                follow the{" "}
                <a
                  className="font-bold text-gray-400 opacity-80 duration-200"
                  href="https://flatpak.org/setup/"
                >
                  setup instructions
                </a>
                .
              </p>
            </Trans>
          </div>
        </header>

        {/* <!-- main content --> */}
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <h2>{t("submitting-apps")}</h2>
          <Trans i18nKey={"common:submitting-apps-block"}>
            <p>
              App developers can{" "}
              <a href="https://github.com/flathub/flathub/wiki/App-Submission">
                submit their applications
              </a>{" "}
              to be distributed to Flathub&apos;s growing user base, thus
              providing a single gateway to the entire Linux desktop ecosystem.
            </p>
            <p>
              At the moment, applications must either be legally redistributable
              or be available as a third party download. However, if you are a
              proprietary app developer and are interested in using Flathub, we
              would love to talk to you.
            </p>
          </Trans>

          <h2>{t("get-involved")}</h2>
          <Trans i18nKey={"common:get-involved-block"}>
            <p>
              Flathub is an attempt to transform the Linux desktop ecosystem for
              the better, and we need your help. If you can write documentation,
              create websites, administer servers or write code, we would love
              your help.
            </p>
          </Trans>

          <h2>{t("reporting-issues")}</h2>
          <Trans i18nKey={"common:reporting-issues-block"}>
            <p>
              Security or legal issues can be reported to the{" "}
              <a href="mailto:flathub@lists.freedesktop.org">
                Flathub maintainers
              </a>
              .
            </p>
          </Trans>

          <h2>{t("acknowledgements")}</h2>
          <Trans i18nKey={"common:acknowledgements-block"}>
            <p>
              Flathub wouldn&apos;t be possible without the generous support of
              the following organizations and individuals.
            </p>
          </Trans>
          <div>
            <div>Codethink</div>
            <div>Cloud Native Computing Foundation</div>
            <div>Fastly</div>
            <div>Mythic Beasts</div>
            <div>Prerender.io</div>
            <div>Scaleway</div>
            <br />

            <div>Alex Larsson</div>
            <div>Andreas Nilsson</div>
            <div>Arun Raghavan</div>
            <div>Bartłomiej Piotrowski</div>
            <div>Christian Hergert</div>
            <div>Christopher Halse Rogers</div>
            <div>Cosimo Cecchi</div>
            <div>Emmanuele Bassi</div>
            <div>G Stavracas Neto</div>
            <div>Jakub Steiner</div>
            <div>James Shubin</div>
            <div>Joaquim Rocha</div>
            <div>Jorge García Oncins</div>
            <div>Lubomír Sedlář</div>
            <div>Nathan Dyer</div>
            <div>Nick Richards</div>
            <div>Mario Sanchez Prada</div>
            <div>Matthias Clasen</div>
            <div>Michael Doherty</div>
            <div>Robert McQueen</div>
            <div>Zach Oglesby</div>
          </div>
        </section>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  }
}

export default About
