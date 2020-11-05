import Head from 'next/head'
import { FunctionComponent, useState } from 'react'
import { useRouter } from 'next/router'

import Main from './../layout/Main'
import ApplicationCard from './../application/Card'
import Application from '../../types/Application'


interface Props {
  applications: Application[],
  title: string,
  perPage?: number,
}

const ApplicationCollection: FunctionComponent<Props> = ({ applications, title, perPage = 21 }) => {
  const router = useRouter()
  const page = parseInt(router.query.page as string) || 1

  const totalPages = Math.ceil(applications.length / perPage)
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  const pagedApplications = applications.slice((page - 1) * perPage, page * perPage)

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
            {pages.length > 1 && (
              <div className="pagination">
                {pages.map(p => {
                  const isActive = p === page
                  const className = isActive ? "page-active" : ""
                  return (<a onClick={() => {
                    router.push({
                      pathname: router.pathname,
                      query: {
                        page: p.toString()
                      }
                    })
                  }}><div className={`${className} page-link`}>{p}</div></a>)
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Main >
  )
}

export default ApplicationCollection
