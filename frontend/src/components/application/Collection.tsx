import Head from 'next/head'
import Main from './../layout/Main'
import ApplicationCard from './../application/Card'
import Sidebar from './../layout/Sidebar'
import { FunctionComponent } from 'react'
import Application from '../../types/Application'

interface Props {
  applications: Application[],
  title: string
}

const ApplicationCollection: FunctionComponent<Props> = ({ applications, title }) => {
  return (
    <Main>
      <Head>
        <title>{title}</title>
      </Head>

      <div className='apps-collection'>
        <Sidebar />

        <div className='collection'>
          <h2>{title}</h2>
          <p>{applications.length} results</p>

          <div className='apps'>
            {applications.map((app) => (
              <ApplicationCard key={app.flatpakAppId} application={app} />
            ))}
          </div>
        </div>
      </div>
    </Main>
  )
}

export default ApplicationCollection
