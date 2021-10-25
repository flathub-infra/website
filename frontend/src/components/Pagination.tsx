import { FunctionComponent } from 'react'
import { useRouter } from 'next/router'

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
    <div className='pagination'>
      {pages.map((p, index) => {
        const isActive = p === currentPage
        const className = isActive ? 'page-active' : ''

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
          >
            <div className={`${className} page-link`}>{p}</div>
          </a>
        )
      })}
    </div>
  )
}
export default Pagination
