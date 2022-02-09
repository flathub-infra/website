import { FunctionComponent } from 'react'
import styles from './FeedbackMessage.module.scss'

interface Props {
  success: boolean,
  message: string,
}

const FeedbackMessage: FunctionComponent<Props> = ({ success, message }) => {
  const status = success ? styles.success : styles.failure
  const classes = `${styles.feedback} ${status}`

  return (
    <div className={classes}>
      <p>{message}</p>
    </div>
  )
}

export default FeedbackMessage
