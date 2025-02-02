import { Button } from "@/components/ui/button"
import clsx from "clsx"
import { GetStaticProps } from "next"
import { Trans, useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import Link from "next/link"

const Acknowledgments = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("acknowledgements")}</h2>
      <Trans i18nKey={"common:acknowledgements-block"}>
        <p>
          Flathub wouldn&apos;t be possible without the generous support of the
          following organizations and individuals.
        </p>
      </Trans>
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h3 className="my-4 text-xl font-semibold">
            {t("organizations-and-infrastructure")}
          </h3>
          <div className="ps-4">
            <ul className="list-outside list-disc text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
              <li>Codethink</li>
              <li>Cloud Native Computing Foundation</li>
              <li>Fastly</li>
              <li>Mythic Beasts</li>
              <li>Prerender.io</li>
              <li>Scaleway</li>
            </ul>
          </div>
        </div>
        <div>
          <h3 className="my-4 text-xl font-semibold">
            {t("individual-contributors")}
          </h3>
          <div className="ps-4">
            <ul className="list-outside list-disc text-flathub-dark-gunmetal dark:text-flathub-gainsborow">
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
          </div>
        </div>
      </div>
    </div>
  )
}

const Users = () => {
  const { t } = useTranslation()

  return (
    <div className="basis-1/2">
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("users")}</h2>
      <p>
        <Trans i18nKey={"common:all-the-apps-you-want"}>
          <span className="font-bold">All the apps you want</span> — From big
          names you&apos;d expect to fresh indie developers, Flathub has
          thousands of apps to meet your needs.
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:transparent-safety"}>
          <span className="font-bold">Transparent safety</span> — Clearly see
          when an app is{" "}
          <a
            href="https://docs.flathub.org/docs/for-users/verification/"
            target="_blank"
            rel="noreferrer"
          >
            verified
          </a>{" "}
          as coming from its developer, what permissions it requires, and
          whether or not it&apos;s open source and auditable
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:tastefully-curated"}>
          <span className="font-bold">Tastefully curated</span> — Discover
          interesting, quality apps across Flathub with our staff curation that
          showcases the best on offer
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:apps-for-you-where-you-are"}>
          <span className="font-bold">Apps for you where you are</span> —
          Whether you&apos;re on a Steam Deck, a powerful Linux workstation, a
          Raspberry Pi, or the rare Linux phone; Flathub has apps for you
        </Trans>
      </p>
      <div className="mt-10 flex gap-3">
        <Link href={"/setup"} className="w-1/2 sm:w-auto">
          <Button size="xl" className="w-full">
            {t("setup")}
          </Button>
        </Link>
        <Link href={"/"} className="w-1/2 sm:w-auto">
          <Button size="xl" className="w-full">
            {t("get-apps")}
          </Button>
        </Link>
      </div>
    </div>
  )
}

const Developers = () => {
  const { t } = useTranslation()

  return (
    <div className="basis-1/2">
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("developers")}</h2>
      <p>
        <Trans i18nKey={"common:millions-users"}>
          <span className="font-bold">Reach millions of users</span> — Flathub
          comes out of the box on multiple Linux distros, is{" "}
          <Link href="/setup">easily installable</Link> on the rest, and has
          over a million active users
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:transparent"}>
          <span className="font-bold">Independent & transparent</span> —
          We&apos;re a grassroots open source community stewarding the best of
          what the ecosystem has to offer
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:docs-guidance"}>
          <span className="font-bold">Clear docs & guidance</span> — Extensive
          <a
            href="https://docs.flathub.org/docs/category/for-app-authors"
            target="_blank"
            rel="noreferrer"
          >
            {" "}
            documentation
          </a>
          , thousands of public{" "}
          <a
            href="https://github.com/flathub/"
            target="_blank"
            rel="noreferrer"
          >
            app manifests
          </a>
          , and a large community means you&apos;re always able to get help
        </Trans>
      </p>
      <p>
        <Trans i18nKey={"common:integration"}>
          <span className="font-bold">Native app store integration</span> —
          Forget web downloads; Flathub delivers apps and{" "}
          <a
            href="https://docs.flathub.org/docs/for-app-authors/updates"
            target="_blank"
            rel="noreferrer"
          >
            automatic updates
          </a>{" "}
          to users in their native app store client where they&apos;d expect
        </Trans>
      </p>
      <div className="mt-10 flex">
        <a
          href={"https://docs.flathub.org/docs/category/for-app-authors"}
          target="_blank"
          rel="noreferrer"
          className="w-full sm:w-auto"
        >
          <Button size="xl" className="w-full">
            {t("publish-your-app")}
          </Button>
        </a>
      </div>
    </div>
  )
}

const GetInTouch = () => {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("get-in-touch")}</h2>
      <div
        className={clsx(
          "grid grid-cols-1 gap-x-14 grid-rows-auto sm:grid-cols-3",
        )}
      >
        <h3 className="my-4 text-xl font-semibold">{t("press")}</h3>
        <p className="sm:row-start-2">{t("press-description")}</p>
        <div className="sm:row-start-3 flex flex-col gap-3">
          <a
            href="https://docs.flathub.org/blog"
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:underline"
          >
            {t("read-announcements")}
          </a>
          <a
            href="https://github.com/flathub-infra/assets"
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:underline"
          >
            {t("download-press-kit")}
          </a>
          <a
            href="mailto:admins@flathub.org"
            className="no-underline hover:underline"
          >
            {t("contact-for-press-inquiries")}
          </a>
        </div>
        <h3 className="my-4 text-xl font-semibold pt-6 sm:pt-0">
          {t("reporting-issues")}
        </h3>
        <p className="sm:row-start-2">{t("reporting-issues-description")}</p>
        <div className="sm:row-start-3 flex flex-col gap-3">
          <a
            href="mailto:admins@flathub.org"
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:underline"
          >
            {t("report-an-issue")}
          </a>
        </div>
        <h3 className="my-4 text-xl font-semibold pt-6 sm:pt-0">
          {t("developers-and-users")}
        </h3>
        <p className="sm:row-start-2">{t("developers-and-users-block")}</p>
        <div className="sm:row-start-3 flex flex-col gap-3">
          <a
            href="https://discourse.flathub.org"
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:underline"
          >
            {t("join-discourse-forum")}
          </a>
          <div>
            <a
              href="https://matrix.to/#/#flathub:matrix.org"
              target="_blank"
              rel="noreferrer"
              className="no-underline hover:underline"
            >
              {t("chat-on-matrix")}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

const About = ({ locale }: { locale: string }) => {
  const { t } = useTranslation()

  return (
    <>
      <NextSeo
        title={t("about-pagename")}
        description={t("about-description")}
        openGraph={{
          url: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}/about`,
        }}
        noindex={locale === "en-GB"}
      />
      <div className="flex max-w-full flex-col">
        <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
          <h1 className="mt-8 mb-6 text-4xl font-extrabold">
            {t("about-pagename")}
          </h1>
          <Trans i18nKey={"common:about-claim"}>
            <h2 className="mb-6 text-xl">
              Whether you&apos;re a user looking for apps or a developer looking
              to reach more users,{" "}
              <span className="font-bold">
                Flathub is the best choice for apps on Linux.
              </span>
            </h2>
          </Trans>
        </section>

        {/* <!-- main content --> */}
        <section
          className={`flex gap-8 flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}
        >
          <div className="flex flex-col  sm:flex-row gap-12">
            <Users />
            <Developers />
          </div>

          <GetInTouch />

          <Acknowledgments />
        </section>
      </div>
    </>
  )
}

export const getStaticProps: GetStaticProps = async ({
  locale,
}: {
  locale: string
}) => {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      locale,
    },
    revalidate: 900,
  }
}

export default About
