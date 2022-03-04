import { useTranslation } from 'next-i18next'
import { FunctionComponent } from 'react'
import styles from './Spinner.module.scss'

interface Props {
  size: number, // Size in pixels
  text?: string, // Message to display underneath
}

const Spinner: FunctionComponent<Props> = ({ size, text = undefined }) => {
  const { t } = useTranslation()
  if (!text) {
    text = t('loading')
  }

  // SVG of a circle with a highlighted 90 degree arc on the border
  // Made to spin via CSS animation
  return (
    // Spinner will always be centered and padded relative to its size
    <div className={styles.container} style={{ padding: `${size / 2}px` }}>
      <svg className={styles.spinner}
        width={size}
        height={size}
        viewBox='0 0 100 100'
        xmlns='http://www.w3.org/2000/svg'
      >
        <circle cx='50' cy='50' r='50' className={styles.back} />
        <path className={styles.front} d='M50,50l0,50a50,50 0 0 1 -50,-50z' />
        <circle cx='50' cy='50' r='45' className={styles.center} />
      </svg>
      {text ? <p>{text}</p> : <></>}
    </div>
  )
}

export default Spinner
