import { useTranslation } from "next-i18next"
import Link from "next/link"
import { FunctionComponent } from "react"
import { MdChevronRight, MdHome } from "react-icons/md"

interface Props {
  pages: { name: string; href: string; current: boolean }[]
}

/** A link placed at the top of a page's main container to return to some other page */
const Breadcrumbs: FunctionComponent<Props> = ({ pages }) => {
  const { t } = useTranslation()

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-4">
        <li>
          <div>
            <a href="" className="text-zinc-400 hover:text-gray-500">
              <MdHome className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">{t("home")}</span>
            </a>
          </div>
        </li>
        {pages.map((page) => (
          <li key={page.name}>
            <div className="flex items-center">
              <MdChevronRight
                className="h-5 w-5 flex-shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <Link href={page.href} passHref>
                <a
                  className="ml-4 text-sm font-medium text-zinc-400 no-underline hover:text-zinc-500"
                  aria-current={page.current ? "page" : undefined}
                >
                  {t(page.name)}
                </a>
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
