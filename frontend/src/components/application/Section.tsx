import { FunctionComponent } from 'react'
import Link from 'next/link'

import { Appstream } from '../../types/Appstream'

import ApplicationCard from './Card'

interface Props {
  applications: Appstream[]
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

      <Link href={href} passHref>
        <button className='primary-button'>
          <div>Show All</div>
        </button>
      </Link>
    </header>
    <div className='applications'>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} />
      ))}
    </div>
  </div>
)

export default ApplicationSection
