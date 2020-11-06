import Head from 'next/head'
import { FunctionComponent } from 'react'
import { useRouter } from 'next/router'
import Pagination from './../Pagination'

import Main from './../layout/Main'
import ApplicationCard from './../application/Card'
import Application from '../../types/Application'


interface Props {
  applications: Application[]
  title: string
  perPage?: number
}

const ApplicationCollection: FunctionComponent<Props> = ({
  applications,
  title,
  perPage = 20,
}) => {
  const router = useRouter()
  const page = parseInt(router.query.page as string) || 1
  const totalPages = Math.ceil(applications.length / perPage)
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const pagedApplications = applications.slice(
    (page - 1) * perPage,
    page * perPage
  )

  return (
    <Main>
      <Head>
        <title>{title}</title>
      </Head>
      <div className='main-container'>
        <div className='applications-collection'>
          <div className='collection'>
            <h2>{title}</h2>
            <p>{applications.length} results</p>

            <div className='applications'>
              {pagedApplications.map((app) => (
                <ApplicationCard key={app.flatpakAppId} application={app} />
              ))}
            </div>

            <Pagination pages={pages} currentPage={page} />
          </div>
        </div>
      </div>
    </Main>
  )
}

export default ApplicationCollection


