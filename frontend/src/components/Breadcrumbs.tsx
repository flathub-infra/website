import { useTranslation } from "next-i18next"
import { BreadcrumbJsonLd } from "next-seo"
import Link from "next/link"
import { FunctionComponent } from "react"
import { HiChevronRight, HiHome } from "react-icons/hi2"

interface Props {
  pages: { name: string; href: string; current: boolean }[]
}

/** A link placed at the top of a page's main container to return to some other page */
const Breadcrumbs: FunctionComponent<Props> = ({ pages }) => {
  const { t } = useTranslation()

  return (
    <>
      <BreadcrumbJsonLd
        itemListElements={[
          {
            position: 1,
            name: t("home"),
            item: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}`,
          },
          ...pages.map((page) => ({
            position: pages.indexOf(page) + 2,
            name: page.name,
            item: `${process.env.NEXT_PUBLIC_SITE_BASE_URI}${page.href}`,
          })),
        ]}
      />
      <nav className="flex">
        <ol role="list" className="flex items-center space-x-4">
          <li>
            <div>
              <Link
                href="/"
                className="text-flathub-granite-gray hover:text-flathub-arsenic dark:text-flathub-gray-x11 dark:hover:text-flathub-gainsborow"
              >
                <HiHome className="size-5 flex-shrink-0" aria-hidden="true" />
                <span className="sr-only">{t("home")}</span>
              </Link>
            </div>
          </li>
          {pages.map((page) => (
            <li key={page.name}>
              <div className="flex items-center">
                <HiChevronRight
                  className="size-5 flex-shrink-0 text-flathub-granite-gray dark:text-flathub-gray-x11 rtl:rotate-180"
                  aria-hidden="true"
                />
                <Link
                  href={page.href}
                  passHref
                  className="ms-4 text-sm font-medium text-flathub-granite-gray hover:text-flathub-arsenic dark:text-flathub-gray-x11 dark:hover:text-flathub-gainsborow"
                  aria-current={page.current ? "page" : undefined}
                >
                  {t(page.name)}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}

export default Breadcrumbs
