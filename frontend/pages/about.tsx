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
          <h1 className="mt-8 text-4xl font-extrabold">
            {t("about-pagename")}
          </h1>
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
              <Link className="no-underline hover:underline" href="/setup">
                setup instructions
              </Link>
              .
            </p>
          </Trans>
        </section>

        {/* <!-- main content --> */}
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("submitting-apps")}
          </h2>
          <Trans i18nKey={"common:submitting-apps-block"}>
            <p>
              App developers can{" "}
              <a
                className="no-underline hover:underline"
                href="https://docs.flathub.org/docs/for-app-authors/submission"
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

          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("about-app-verification")}
          </h2>
          <Trans i18nKey="about-app-verification-block">
            <h3 className="my-4 text-xl font-semibold">
              What does the checkmark under an app name mean?
            </h3>
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

            <h3 className="my-4 text-xl font-semibold">
              I&apos;m publishing an app on Flathub. How do I get it verified?
            </h3>
            <p>
              First,{" "}
              <Link className="no-underline hover:underline" href="/login">
                log in to Flathub
              </Link>
              . Find &quot;Developer Portal&quot; in the footer of the page.
              Click the app you want to verify then find the
              &quot;Verification&quot; section. The instructions there will walk
              you through the verification process.
            </p>
          </Trans>

          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("reporting-issues")}
          </h2>
          <Trans i18nKey={"common:reporting-issues-block"}>
            <p>
              Security or legal issues can be reported to the{" "}
              <a
                className="no-underline hover:underline"
                href="mailto:admins@flathub.org"
              >
                Flathub maintainers
              </a>
              .
            </p>
          </Trans>

          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("press-information")}
          </h2>
          <Trans i18nKey={"common:press-information-block"}>
            <p>
              We are very happy to answer questions from journalists and tech
              writers. Interview opportunities can also be arranged.
            </p>

            <h3>Graphics and Logos</h3>

            <p>
              Flathub graphic assets can be found{" "}
              <a
                className="no-underline hover:underline"
                target="_blank"
                rel="noreferrer"
                href="https://github.com/flathub-infra/assets"
              >
                here
              </a>
              .
            </p>

            <h3>Contact</h3>
            <p>
              Press queries, including requests for comments and interviews can
              be directed to{" "}
              <a
                className="no-underline hover:underline"
                href="mailto:admins@flathub.org"
              >
                Flathub maintainers
              </a>
              .
            </p>
          </Trans>

          <h2 className="mb-6 mt-12 text-2xl font-bold">
            {t("acknowledgements")}
          </h2>
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
    revalidate: 900,
  }
}

export default About
