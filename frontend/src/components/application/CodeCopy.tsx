import { useTranslation } from "next-i18next"
import { FunctionComponent, useEffect, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard"
import { HiCheck, HiSquare2Stack } from "react-icons/hi2"
import { cn } from "@/lib/utils"

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
      className={cn(
        "whitespace-pre-line",
        `relative mx-0 mb-3 mt-0 block overflow-auto break-words p-2 pe-10 text-sm`,
        "font-mono",
        nested
          ? "rounded-lg bg-flathub-gainsborow text-flathub-arsenic dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray"
          : "rounded-xl bg-flathub-gainsborow text-flathub-arsenic dark:bg-flathub-arsenic dark:text-flathub-gray-x11",
        className,
      )}
    >
      {text}
      <CopyToClipboard
        text={text.trim()}
        onCopy={() => {
          setCopied(true)
          if (onCopy) onCopy()
        }}
      >
        <button
          className="absolute end-2 top-[6px] cursor-pointer border-none bg-transparent text-2xl text-flathub-sonic-silver transition hover:text-flathub-dark-gunmetal dark:text-flathub-spanish-gray dark:hover:text-flathub-gainsborow"
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
