import { FunctionComponent } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { MdContentCopy } from 'react-icons/md'

interface Props {
  text: string
}

const CodeCopy: FunctionComponent<Props> = ({ text }) => (
  <>
    <div className='pre'>
      {text}
      <CopyToClipboard text={text}>
        <button className='copy'>
          <MdContentCopy></MdContentCopy>
        </button>
      </CopyToClipboard>
    </div>
  </>
)

export default CodeCopy
