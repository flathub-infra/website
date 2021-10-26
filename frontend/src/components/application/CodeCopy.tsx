import { FunctionComponent } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { MdContentCopy } from 'react-icons/md'
import styles from './CodeCopy.module.scss'

interface Props {
  text: string
}

const CodeCopy: FunctionComponent<Props> = ({ text }) => (
  <>
    <div className={styles.pre}>
      {text}
      <CopyToClipboard text={text}>
        <button className={styles.copy}>
          <MdContentCopy></MdContentCopy>
        </button>
      </CopyToClipboard>
    </div>
  </>
)

export default CodeCopy
