import { FunctionComponent, useEffect, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { MdCheck, MdContentCopy } from 'react-icons/md'
import styles from './CodeCopy.module.scss'

interface Props {
  text: string
  className?: string
  nested?: boolean
}

const CodeCopy: FunctionComponent<Props> = ({ text, className, nested }) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (copied) setCopied(false);
    }, 1200);

    return () => clearTimeout(timeout);
  }, [copied]);


  return (< div className={`${styles.pre} ${className} ${nested ? styles.nested : ''}`}>
    {text}
    < CopyToClipboard text={text} onCopy={() => setCopied(true)}>
      <button className={styles.copy} title='Copy text'>
        {!copied && <MdContentCopy></MdContentCopy>}
        {copied && <MdCheck style={{ 'color': "green" }}></MdCheck>}
      </button>
    </CopyToClipboard >
  </div >
  )
}

export default CodeCopy
