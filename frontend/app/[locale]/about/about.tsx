"use client"

import { Button } from "@/components/ui/button"
import clsx from "clsx"
import { Link } from "src/i18n/navigation"
import type { JSX } from "react"
import { useTranslations } from "next-intl"

const Acknowledgments = () => {
  const t = useTranslations()

  return (
    <div>
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("acknowledgements")}</h2>
      {t.rich("acknowledgements-block", {
        p: (chunk) => <p>{chunk}</p>,
      })}
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
  const t = useTranslations()

  return (
    <div className="basis-1/2">
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("users")}</h2>
      <p>
        {t.rich("all-the-apps-you-want", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
        })}
      </p>
      <p>
        {t.rich("transparent-safety", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
          verifiedlink: (chunk) => (
            <a
              href="https://docs.flathub.org/docs/for-users/verification/"
              target="_blank"
              rel="noreferrer"
            >
              {chunk}
            </a>
          ),
        })}
      </p>
      <p>
        {t.rich("tastefully-curated", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
        })}
      </p>
      <p>
        {t.rich("apps-for-you-where-you-are", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
        })}
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
  const t = useTranslations()

  return (
    <div className="basis-1/2">
      <h2 className="mb-6 mt-12 text-2xl font-bold">{t("developers")}</h2>
      <p>
        {t.rich("millions-users", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
          installlink: (chunk) => <Link href="/setup">{chunk}</Link>,
        })}
      </p>
      <p>
        {t.rich("transparent", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
        })}
      </p>
      <p>
        {t.rich("docs-guidance", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
          doclink: (chunk) => (
            <a
              href="https://docs.flathub.org/docs/category/for-app-authors"
              target="_blank"
              rel="noreferrer"
            >
              {chunk}
            </a>
          ),
          manifestlink: (chunk) => (
            <a
              href="https://github.com/flathub/"
              target="_blank"
              rel="noreferrer"
            >
              {chunk}
            </a>
          ),
        })}
      </p>
      <p>
        {t.rich("integration", {
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
          updateslink: (chunk) => (
            <a
              href="https://docs.flathub.org/docs/for-app-authors/updates"
              target="_blank"
              rel="noreferrer"
            >
              {chunk}
            </a>
          ),
        })}
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
  const t = useTranslations()

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

const AboutClient = (): JSX.Element => {
  const t = useTranslations()

  return (
    <div className="flex max-w-full flex-col">
      <section className={`flex flex-col px-[5%] md:px-[20%] 2xl:px-[30%]`}>
        <h1 className="mt-8 mb-6 text-4xl font-extrabold">
          {t("about-pagename")}
        </h1>
        {t.rich("about-claim", {
          text: (chunk) => <h2 className="mb-6 text-xl">{chunk}</h2>,
          bold: (chunk) => <span className="font-bold">{chunk}</span>,
        })}
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
  )
}

export default AboutClient
