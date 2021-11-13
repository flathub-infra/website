import { FunctionComponent } from 'react'
import Link from 'next/link'

import { Appstream } from '../../types/Appstream'

import ApplicationCard from './Card'
import styles from './Section.module.scss'
import Button from '../Button'

interface Props {
  href: string
  title: string
  applications: Appstream[]
}

const ApplicationSection: FunctionComponent<Props> = ({
  href,
  title,
  applications,
}) => (
  <div className={styles.applicationsSection}>
    <header>
      <h3>{title}</h3>

      <Link href={href} passHref>
        <Button>Show more</Button>
      </Link>
    </header>
    <div className={styles.applications}>
      {applications.map((app) => (
        <ApplicationCard key={app.id} application={app} />
      ))}
    </div>
  </div>
)

export default ApplicationSection
