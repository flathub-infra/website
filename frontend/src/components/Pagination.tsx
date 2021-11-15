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
      {pages.map((p, index) => {
        const isActive = p === currentPage
        const className = isActive ? `${styles.pageActive}` : ''

        return (
          <a
            onClick={() => {
              router.push({
                pathname: router.pathname,
                query: {
                  ...router.query,
                  page: p.toString(),
                },
              })
            }}
            key={`pagination-${index}`}
            className={`${className} ${styles.pageLink}`}
          >
            {p}
          </a>
        )
      })}
    </div>
  )
}
export default Pagination
