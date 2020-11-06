import Link from 'next/link'
import { FunctionComponent } from 'react'

import Application from '../../types/Application'

import ApplicationCard from './Card'

interface Props {
  applications: Application[]
  href: string
  title: string
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
}) => (
  <div className='applications-section'>
    <header>
      <h3>{title}</h3>

      <Link href={href}>
        <button className='show-all-button'>
          <div>Show All</div>
          <img src='/go-next.svg' alt='Next' />
        </button>
      </Link>
    </header>
    <div className='applications'>
      {applications.map((app) => (
        <ApplicationCard key={app.flatpakAppId} application={app} />
      ))}
    </div>
  </div>
)

export default ApplicationSection
