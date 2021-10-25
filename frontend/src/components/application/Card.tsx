import { FunctionComponent } from 'react'
import Link from 'next/link'

import Appstream from '../../types/Appstream'

interface Props {
  application: Appstream
}

const ApplicationCard: FunctionComponent<Props> = ({ application }) => (
  <Link href={`/apps/details/${application.id}`} passHref>
    <div className='application-card'>
      <div className='logo'>
        <img src={application.icon} alt={application.name} />
      </div>
      <div className='summary'>
        <h5>{application.name}</h5>
        <p>{application.summary}</p>
      </div>
    </div>
  </Link>
)

export default ApplicationCard
