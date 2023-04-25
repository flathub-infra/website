import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"

const About = () => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("about")}
        description={t("about-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/about`,
        }}
      />
      <div className="prose flex max-w-full flex-col dark:prose-invert">
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <h1 className="mt-8">{t("about-pagename")}</h1>
          <Trans i18nKey={"common:about-block"}>
            <p>
              Flathub aims to be the place to get and distribute apps for Linux.
              It is powered by
              <a
                className="no-underline hover:underline"
                href="https://flatpak.org"
                target="_blank"
                rel="noreferrer"
              >
                Flatpak
              </a>{" "}
              which allows Flathub apps to run on almost any Linux distribution.
            </p>

            <p>
              If you are a Linux user, you can use Flathub to gain access to a
              growing collection of Flatpak applications. You just need to
              follow the{" "}
              <a
                className="no-underline hover:underline"
                href="https://flatpak.org/setup/"
                target="_blank"
                rel="noreferrer"
              >
                setup instructions
              </a>
              .
            </p>
          </Trans>
        </section>

        {/* <!-- main content --> */}
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <h2>{t("submitting-apps")}</h2>
          <Trans i18nKey={"common:submitting-apps-block"}>
            <p>
              App developers can{" "}
              <a
                className="no-underline hover:underline"
                href="https://github.com/flathub/flathub/wiki/App-Submission"
                target="_blank"
                rel="noreferrer"
              >
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

          <h2>{t("about-app-verification")}</h2>
          <Trans i18nKey="about-app-verification-block">
            <h3>What does the checkmark under an app name mean?</h3>
            <p>
              Some apps have a checkmark on the app page under the developer
              name. This means the app is published on Flathub by its original
              developer or a third party approved by the developer.
            </p>
            <p>
              Some apps are published by third parties that are unaffiliated
              with the original developer. This is allowed, but such apps are
              not eligible for the checkmark.
            </p>
            <p>
              Next to the checkmark is a link to the developer&apos;s website or
              to their profile on a source code hosting site. Flathub has
              verified the developer&apos;s identity using that link.
            </p>

            <h3>
              I&apos;m publishing an app on Flathub. How do I get it verified?
            </h3>
            <p>
              First,{" "}
              <Link className="no-underline hover:underline" href="/login">
                log in to Flathub
              </Link>
              . Click the &quot;Developer Settings&quot; button under the app
              you want to verify. At the top of the page, find the &quot;Setup
              Verification&quot; section. The instructions there will walk you
              through the verification process.
            </p>
          </Trans>

          <h2>{t("reporting-issues")}</h2>
          <Trans i18nKey={"common:reporting-issues-block"}>
            <p>
              Security or legal issues can be reported to the{" "}
              <a
                className="no-underline hover:underline"
                href="mailto:flathub@lists.freedesktop.org"
              >
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
          <ul>
            <li>Codethink</li>
            <li>Cloud Native Computing Foundation</li>
            <li>Fastly</li>
            <li>Mythic Beasts</li>
            <li>Prerender.io</li>
            <li>Scaleway</li>
            <br />

            <li>Alex Larsson</li>
            <li>Andreas Nilsson</li>
            <li>Arun Raghavan</li>
            <li>Bartłomiej Piotrowski</li>
            <li>Christian Hergert</li>
            <li>Christopher Halse Rogers</li>
            <li>Cosimo Cecchi</li>
            <li>Emmanuele Bassi</li>
            <li>G Stavracas Neto</li>
            <li>Jakub Steiner</li>
            <li>James Shubin</li>
            <li>Joaquim Rocha</li>
            <li>Jorge García Oncins</li>
            <li>Lubomír Sedlář</li>
            <li>Nathan Dyer</li>
            <li>Nick Richards</li>
            <li>Mario Sanchez Prada</li>
            <li>Matthias Clasen</li>
            <li>Michael Doherty</li>
            <li>Robert McQueen</li>
            <li>Zach Oglesby</li>
          </ul>
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
