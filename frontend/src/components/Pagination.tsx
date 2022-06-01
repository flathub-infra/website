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
    <div className="mx-auto mt-12 flex h-12 w-min items-center rounded-xl bg-bgColorSecondary text-xl text-colorSecondary shadow-md">
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
                className={`${
                  isActive ? `font-bold` : ""
                } h-12 w-12 py-2 text-center no-underline duration-500 first:rounded-tl-xl first:rounded-bl-xl last:rounded-tr-xl last:rounded-br-xl hover:cursor-pointer hover:bg-colorPrimary hover:text-gray-100`}
              >
                {curr}
              </a>
            </React.Fragment>
          )
        })}
    </div>
  )
}
export default Pagination
