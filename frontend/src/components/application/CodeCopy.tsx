import { useTranslations } from "next-intl"
import { FunctionComponent, useEffect, useState } from "react"
import { CopyToClipboard } from "react-copy-to-clipboard-ts"
import { CheckIcon, Square2StackIcon } from "@heroicons/react/24/solid"
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
  const t = useTranslations()
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (status !== "copied") {
      return
    }
    const timeout = setTimeout(() => setStatus("idle"), 3000)

    return () => clearTimeout(timeout)
  }, [status])

  return (
    <div
      className={cn(
        "whitespace-pre-line",
        "relative mx-0 mb-3 mt-0 min-w-0 p-3 pe-14 text-sm",
        nested
          ? "rounded-lg bg-flathub-gainsborow text-flathub-arsenic dark:bg-flathub-dark-gunmetal dark:text-flathub-spanish-gray"
          : "rounded-xl bg-flathub-gainsborow text-flathub-arsenic dark:bg-flathub-arsenic dark:text-flathub-gray-x11",
        className,
      )}
    >
      <code
        dir="ltr"
        className="block whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        {text}
      </code>
      <CopyToClipboard
        text={text.trim()}
        options={{ message: t("copy-failed") }}
        onCopy={(_, success) => {
          setStatus(success ? "copied" : "failed")
          if (success && onCopy) {
            onCopy()
          }
        }}
      >
        <button
          type="button"
          className="absolute end-0 top-0 flex size-11 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-2xl text-flathub-sonic-silver transition hover:text-flathub-dark-gunmetal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flathub-celestial-blue dark:text-flathub-spanish-gray dark:hover:text-flathub-gainsborow"
          title={t("copy-text")}
          aria-label={t("copy-text")}
        >
          {status !== "copied" && (
            <Square2StackIcon aria-hidden="true" className="size-6" />
          )}
          {status === "copied" && (
            <CheckIcon aria-hidden="true" className="text-green-600 size-6" />
          )}
        </button>
      </CopyToClipboard>
      <span
        role="status"
        className={status === "idle" ? "sr-only" : "mt-2 block"}
      >
        {status === "copied"
          ? t("copy-success")
          : status === "failed"
            ? t("copy-failed")
            : ""}
      </span>
    </div>
  )
}

export default CodeCopy
