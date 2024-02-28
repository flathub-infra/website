import { GetStaticProps } from "next"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { NextSeo } from "next-seo"
import LoginGuard from "../src/components/login/LoginGuard"
import UserApps from "../src/components/user/UserApps"
import { IS_PRODUCTION } from "src/env"
import VendingLink from "src/components/user/VendingLink"
import { useUserContext } from "src/context/user-info"
import ButtonLink from "src/components/ButtonLink"
import CodeCopy from "src/components/application/CodeCopy"
import { HiMiniPlus } from "react-icons/hi2"
import Breadcrumbs from "src/components/Breadcrumbs"
import axios from "axios"
import { format } from "date-fns"

const InviteCode = ({}) => {
  const { t } = useTranslation()
  const user = useUserContext()

  if (user.loading) {
    return null
  }

  if (IS_PRODUCTION || !user.info?.is_moderator) {
    return null
  }

  const inviteCode = user.info?.invite_code.replace(/(.{3})(?!$)/g, "$1-")

  return (
    <>
      <div>
        <UserApps variant="invited" />
        <div className="flex items-baseline gap-1">
          {t("invite-code")}
          <CodeCopy className="w-48" text={inviteCode} nested />
        </div>
        <div className="text-sm text-flathub-sonic-silver dark:text-flathub-spanish-gray">
          {t("invite-code-hint")}
        </div>
      </div>
    </>
  )
}

const AcceptingPayment = ({}) => {
  const { t } = useTranslation()
  const user = useUserContext()

  if (user.loading) {
    return null
  }

  if (IS_PRODUCTION || user.info?.dev_flatpaks.length === 0) {
    return null
  }

  return (
    <div className="my-auto">
      <h3 className="my-4 text-xl font-semibold">{t("accepting-payment")}</h3>
      <VendingLink />
    </div>
  )
}

const News = ({ feed }: { feed: DocusaurusFeed }) => {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-2xl font-bold mb-3">{t("news")}</h2>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:mx-0 lg:max-w-none lg:grid-cols-3">
        {feed.items.slice(0, 3).map((feedItem) => (
          <article
            key={feedItem.id}
            className="flex max-w-xl flex-col items-start justify-between"
          >
            <div className="flex items-center gap-x-4 text-xs">
              <time
                dateTime={feedItem.date_modified}
                className="text-flathub-sonic-silver dark:text-flathub-sonic-silver"
              >
                {format(new Date(feedItem.date_modified), "P")}
              </time>
            </div>
            <div className="group relative">
              <h3 className="mt-3 text-lg font-semibold leading-6">
                <a
                  href={feedItem.id}
                  target="_blank"
                  rel="noreferrer"
                  className="no-underline hover:underline"
                >
                  <span className="absolute inset-0" />
                  {feedItem.title}
                </a>
              </h3>
              <p className="mt-5 line-clamp-3 text-sm leading-6 text-flathub-granite-gray dark:text-flathub-spanish-gray">
                {feedItem.summary}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

const DeveloperApps = ({}) => {
  const { t } = useTranslation()
  const user = useUserContext()

  if (user.loading) {
    return null
  }

  return (
    <UserApps
      variant="dev"
      customButtons={
        (!IS_PRODUCTION || user.info?.is_moderator) && (
          <ButtonLink className="w-full sm:w-auto" passHref href="/apps/new">
            <HiMiniPlus className="w-5 h-5" />
            {t("new-app")}
          </ButtonLink>
        )
      }
    />
  )
}

export default function DeveloperPortal({ feed }: { feed: DocusaurusFeed }) {
  const { t } = useTranslation()

  const pages = [
    { name: t("developer-portal"), current: true, href: "/developer-portal" },
  ]

  return (
    <>
      <NextSeo title={t("developer-portal")} noindex={true} />
      <div className="max-w-11/12 mx-auto my-0 w-11/12 2xl:w-[1400px] 2xl:max-w-[1400px]">
        <LoginGuard>
          <div className="space-y-12">
            <Breadcrumbs pages={pages} />
            <div className="mt-4 p-4 flex flex-wrap gap-3 rounded-xl bg-flathub-white shadow-md dark:bg-flathub-arsenic">
              <>
                <h1 className="text-4xl font-extrabold">
                  {t("developer-portal")}
                </h1>
                <div className="space-y-12 w-full">
                  <News feed={feed} />

                  <DeveloperApps />

                  <InviteCode />

                  <AcceptingPayment />
                </div>
              </>
            </div>
          </div>
        </LoginGuard>
      </div>
    </>
  )
}

type DocusaurusFeed = {
  version: string
  title: string
  home_page_url: string
  description: string
  items: {
    id: string
    content_html: string
    url: string
    title: string
    summary: string
    date_modified: string
    author: { name: string; url: string }
    tags: string[]
  }[]
}

export const getStaticProps: GetStaticProps = async ({ locale }) => {
  const feed = await axios.get<DocusaurusFeed>(
    "https://docs.flathub.org/blog/feed.json",
  )

  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
      feed: feed.data,
    },
    revalidate: 900,
  }
}
