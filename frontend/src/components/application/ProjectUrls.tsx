import { ProjectUrl } from '../../types/ProjectUrl'
import ProjectUrlWidget from './ProjectUrl'
import styles from './ProjectUrls.module.scss'

const ProjectUrls = ({ urls }) => {
  return (
    <div className={styles.urls}>
      {urls && (
        <>
          <div>
            {urls.homepage && (
              <ProjectUrlWidget
                url={urls.homepage}
                type={ProjectUrl.Homepage}
              />
            )}

            {urls.donation && (
              <ProjectUrlWidget url={urls.donation} type={ProjectUrl.Donate} />
            )}

            {urls.translate && (
              <ProjectUrlWidget
                url={urls.translate}
                type={ProjectUrl.Translate}
              />
            )}
          </div>
          <div>
            {urls.bugtracker && (
              <ProjectUrlWidget
                url={urls.bugtracker}
                type={ProjectUrl.Bugtracker}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ProjectUrls
