import { FunctionComponent } from 'react'
import { useRouter } from 'next/router'
import styles from './Pagination.module.scss'

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
    <div className={styles.pagination}>
      {pages
        .filter(
          (page) =>
            (currentPage - 3 < page && currentPage + 3 > page) ||
            pages[0] === page ||
            pages.length === page
        )
        .map((curr, index, array) => {
          const isActive = curr === currentPage
          const className = isActive ? `${styles.pageActive}` : ''

          return (
            <>
              {index > 0 && array[index - 1] + 1 !== curr && (
                <div className={`${styles.pageLink} ${styles.ellipsis}`}>
                  ...
                </div>
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
                key={`pagination-${index}`}
                className={`${className} ${styles.pageLink}`}
              >
                {curr}
              </a>
            </>
          )
        })}
    </div>
  )
}
export default Pagination
