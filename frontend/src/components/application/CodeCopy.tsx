import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { HiCheck, HiSquare2Stack } from "react-icons/hi2"
import styles from "./CodeCopy.module.scss"

interface Props {
  text: string
  onCopy?: () => void
  className?: string
  nested?: boolean
}

const CodeCopy: FunctionComponent<Props> = ({
  text,
  onCopy,
  className,
  nested,
}) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (copied) setCopied(false)
    }, 1200)

    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <div
      className={`relative mx-0 mt-0 mb-3 block overflow-auto rounded-xl bg-bgColorSecondary p-2 pr-10 text-sm text-textSecondary shadow-md ${
        styles.pre
      } ${className ?? ""} ${nested ? "bg-bgColorPrimary" : ""}`}
    >
      {text}
      <CopyToClipboard
        text={text}
        onCopy={() => {
          setCopied(true)
          if (onCopy) onCopy()
        }}
      >
        <button
          className="absolute right-1 top-1 cursor-pointer border-none bg-transparent text-2xl text-textSecondary hover:text-textPrimary"
          title={t("copy-text")}
        >
          {!copied && <HiSquare2Stack></HiSquare2Stack>}
          {copied && <HiCheck className="text-green-600"></HiCheck>}
        </button>
      </CopyToClipboard>
    </div>
  )
}

export default CodeCopy
