import React, { FunctionComponent } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { clsx } from "clsx"
import { HiEllipsisHorizontal } from "react-icons/hi2"
import { useTranslation } from "next-i18next"

interface Props {
  currentPage: number
  pages: number[]
  onClick?: (page: number) => void
}

const Pagination: FunctionComponent<Props> = ({
  currentPage,
  pages,
  onClick,
}) => {
  const router = useRouter()
  const { t } = useTranslation()

  if (pages.length < 2) {
    return null
  }

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className="mx-auto mt-12 flex h-12 w-min items-center space-x-2 text-xl"
    >
      {pages
        .filter(
          (page) =>
            (currentPage - 3 < page && currentPage + 3 > page) ||
            pages[0] === page ||
            pages.length === page,
        )
        .map((curr, index, array) => {
          const isActive = curr === currentPage

          return (
            <React.Fragment key={`pagination-${index}`}>
              {index > 0 && array[index - 1] + 1 !== curr && (
                <span aria-hidden className={`w-12 flex justify-center`}>
                  <HiEllipsisHorizontal className="size-5" />
                  <span className="sr-only">{t("more-pages")}</span>
                </span>
              )}

              {onClick && (
                <button
                  onClick={() => onClick(curr)}
                  className={clsx(
                    isActive &&
                      `bg-secondary text-flathub-white dark:bg-secondary`,
                    "flex h-12 w-12 rounded-full duration-500 hover:cursor-pointer hover:opacity-50",
                  )}
                >
                  <span className="m-auto">{curr}</span>
                </button>
              )}

              {!onClick && (
                <Link
                  href={{
                    pathname: router.pathname,
                    query: {
                      ...router.query,
                      page: curr.toString(),
                    },
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    isActive && `bg-secondary text-accent-foreground`,
                    "flex h-12 w-12 rounded-full duration-500 hover:cursor-pointer font-bold",
                    "hover:bg-secondary/50 hover:text-accent-foreground",
                    "text-muted-foreground",
                  )}
                >
                  <span className="m-auto">{curr}</span>
                </Link>
              )}
            </React.Fragment>
          )
        })}
    </nav>
  )
}
export default Pagination
