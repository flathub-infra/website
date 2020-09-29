import { FunctionComponent } from 'react'
import Application from '../../types/Application'
import Link from 'next/link'

interface Props {
  application: Application
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => {
  return (
    <Link href={`/apps/details/${application.flatpakAppId}`}>
      <div className='application-card'>
        <div className='logo'>
          <img src={application.iconDesktopUrl} alt={application.name} />
        </div>
        <div className='summary'>
          <h5>{application.name}</h5>
          <p>{application.summary}</p>
        </div>
      </div>
    </Link>
  )
}

export default ApplicationCard
