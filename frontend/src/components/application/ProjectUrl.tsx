import { useMatomo } from '@datapunt/matomo-tracker-react'
import { ProjectUrl } from '../../types/ProjectUrl'
import styles from './ProjectUrl.module.scss'
import Image from 'next/image'
import { MdOpenInNew } from 'react-icons/md'

const ProjectUrlWidget = ({
  url,
  type,
  id: appId,
}: {
  url: string
  type: ProjectUrl
  id: string
}) => {
  const { trackEvent } = useMatomo()

  const linkClicked = () => {
    trackEvent({ category: 'App', action: type, name: appId })
  }

  let label = ''
  let icon = ''
  switch (type) {
    case 'Homepage':
      label = 'Project Website'
      icon = 'website'
      break
    case 'Bugtracker':
      label = 'Report an Issue'
      icon = 'bugtracker'
      break
    case 'Translate':
      label = 'Contribute translations'
      icon = 'translations'
  }

  return (
    <div className={styles.url}>
      <div className={styles.icon}>
        <Image width={16} height={16} src={`/img/${icon}.svg`} alt={icon} />
      </div>
      <div className={styles.details}>
        {label} <br />
        <a href={url} target='_blank' rel='noreferrer' onClick={linkClicked}>
          {url}
        </a>
      </div>
      <div className={styles.externalLink}>
        <a href={url} target='_blank' rel='noreferrer' onClick={linkClicked}>
          <MdOpenInNew />
        </a>
      </div>
    </div>
  )
}

export default ProjectUrlWidget
