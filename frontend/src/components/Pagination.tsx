import React, { FunctionComponent } from "react"
import { useRouter } from "next/router"

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
    <nav className="mx-auto mt-12 flex h-12 w-min items-center space-x-2 text-xl text-gray-900 dark:text-gray-50">
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

              <a
                onClick={() => {
                  router.push({
                    pathname: router.pathname,
                    query: {
                      ...router.query,
                      page: curr.toString(),
                    },
                  })
                }}
                aria-current={isActive ? "page" : null}
                className={`${
                  isActive
                    ? `bg-flathub-cyan-blue-azure text-gray-50 dark:bg-flathub-indigo`
                    : ""
                }  h-12 w-12 rounded-full py-2 text-center no-underline duration-500 hover:cursor-pointer hover:opacity-50`}
              >
                {curr}
              </a>
            </React.Fragment>
          )
        })}
    </nav>
  )
}
export default Pagination
