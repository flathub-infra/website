import { FunctionComponent } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { MdContentCopy } from 'react-icons/md'
import styles from './CodeCopy.module.scss'

interface Props {
  text: string
  className?: string
  nested?: boolean
}

const CodeCopy: FunctionComponent<Props> = ({ text, className, nested }) => (
  <div className={`${styles.pre} ${className} ${nested ? styles.nested : ''}`}>
    {text}
    <CopyToClipboard text={text}>
      <button className={styles.copy} title='Copy text'>
        <MdContentCopy></MdContentCopy>
      </button>
    </CopyToClipboard>
  </div>
)

export default CodeCopy
