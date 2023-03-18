import React, { FunctionComponent } from "react"
import { useRouter } from "next/router"
import Link from "next/link"
import { clsx } from "clsx"

interface Props {
  currentPage: number
  pages: number[]
}

const Pagination: FunctionComponent<Props> = ({ currentPage, pages }) => {
  const router = useRouter()

  if (pages.length < 2) {
    return <></>
  }

  return (
    <nav className="mx-auto mt-12 flex h-12 w-min items-center space-x-2 text-xl">
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
                <div className={`w-12 text-center`}>...</div>
              )}

              <Link
                href={{
                  pathname: router.pathname,
                  query: {
                    ...router.query,
                    page: curr.toString(),
                  },
                }}
                aria-current={isActive ? "page" : null}
                className={clsx(
                  isActive
                    ? `bg-flathub-celestial-blue text-flathub-white dark:bg-flathub-celestial-blue`
                    : "",
                  "flex h-12 w-12 rounded-full duration-500 hover:cursor-pointer hover:opacity-50",
                )}
              >
                <span className="m-auto">{curr}</span>
              </Link>
            </React.Fragment>
          )
        })}
    </nav>
  )
}
export default Pagination
