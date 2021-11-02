import { ProjectUrl } from '../../types/ProjectUrl'
import styles from './ProjectUrl.module.scss'

const ProjectUrlWidget = ({ url, type }) => {
  let label = ''
  let icon = ''
  switch (type) {
    case ProjectUrl.Homepage:
      label = 'Project Website'
      icon = 'website'
      break
    case ProjectUrl.Donate:
      label = 'Donate'
      icon = 'donate'
      break
    case ProjectUrl.Bugtracker:
      label = 'Report an Issue'
      icon = 'bugtracker'
      break
    case ProjectUrl.Translate:
      label = 'Contribute translations'
      icon = 'translations'
  }

  return (
    <div className={styles.url}>
      <div className={styles.icon}>
        <img src={`/img/${icon}.svg`} />
      </div>
      <div className={styles.details}>
        {label} <br />
        <a href={url}>{url}</a>
      </div>
      <div className={styles.externalLink}>
        <a href={url}>
          <img src='/img/external-link.svg' />
        </a>
      </div>
    </div>
  )
}

export default ProjectUrlWidget
