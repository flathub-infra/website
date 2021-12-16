import { FunctionComponent } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { MdContentCopy } from 'react-icons/md'
import styles from './CodeCopy.module.scss'

interface Props {
  text: string
  className?: string
}

const CodeCopy: FunctionComponent<Props> = ({ text, className }) => (
  <div className={`${styles.pre} ${className}`}>
    {text}
    <CopyToClipboard text={text}>
      <button className={styles.copy} title='Copy text'>
        <MdContentCopy></MdContentCopy>
      </button>
    </CopyToClipboard>
  </div>
)

export default CodeCopy
