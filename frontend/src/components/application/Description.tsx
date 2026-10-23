import clsx from "clsx"
import { useMemo, useState, useRef, useEffect, useId } from "react"
import { useTranslations } from "next-intl"
import { sanitizeAppstreamDescription } from "@/lib/helpers"
import linkifyHtml from "linkify-html"
import { DesktopAppstream } from "src/codegen"
import { UnverifiedAppDisclaimer } from "./UnverifiedAppDisclaimer"
import { Button } from "@/components/ui/button"

export const Description = ({
  app,
  developerName,
  isQualityModalOpen,
  isVerified,
}: {
  app: Pick<DesktopAppstream, "description" | "summary">
  developerName?: string | null
  isQualityModalOpen: boolean
  isVerified: boolean
}) => {
  const t = useTranslations()
  const collapsedHeight = 1000

  const description = useMemo(
    () =>
      app.description
        ? linkifyHtml(
            sanitizeAppstreamDescription(app.description).replace(
              /(<p\b[^>]*>)\s*\*\*([\s\S]*?)\*\*\s*(<\/p>)/gi,
              "$1<b>$2</b>$3",
            ),
            {
              rel: "noopener noreferrer",
              target: "_blank",
              validate: {
                url: (value) => /^https:\/\//.test(value),
              },
            },
          )
        : "",
    [app.description],
  )

  const [isExpanded, setIsExpanded] = useState(false)
  const [showCollapseButton, setShowCollapseButton] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const contentId = useId()

  useEffect(() => {
    const content = contentRef.current
    if (!content) {
      return
    }

    const observer = new ResizeObserver(() => {
      setShowCollapseButton(content.scrollHeight > collapsedHeight)
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [description, developerName, isVerified])

  return (
    <div className="flex min-w-0 flex-col items-start gap-4">
      <div className="w-full min-w-0 max-w-prose">
        <h2 className="mt-4 mb-5 text-2xl leading-snug font-semibold tracking-tight text-flathub-dark-gunmetal/85 [overflow-wrap:anywhere] dark:text-flathub-gainsborow/90">
          {app.summary.length > 35 && isQualityModalOpen ? (
            <>
              <span>{app.summary.slice(0, 35)}</span>
              <mark>{app.summary.slice(35, app.summary.length)}</mark>
            </>
          ) : (
            app.summary
          )}
        </h2>
        <div
          id={contentId}
          onFocusCapture={() => setIsExpanded(true)}
          className={clsx(
            "prose relative max-w-none overflow-hidden [overflow-wrap:anywhere] dark:prose-invert",
            !isExpanded &&
              showCollapseButton &&
              "before:from-flathub-lotion before:pointer-events-none before:absolute before:bottom-0 before:start-0 before:h-1/3 before:w-full before:bg-linear-to-t before:content-[''] dark:before:from-flathub-dark-gunmetal",
          )}
          style={{
            maxHeight:
              isExpanded || !showCollapseButton
                ? "none"
                : `${collapsedHeight}px`,
          }}
        >
          <div
            ref={contentRef}
            className="flow-root [&>:first-child>:first-child]:mt-0"
          >
            <div dangerouslySetInnerHTML={{ __html: description }} />
            <UnverifiedAppDisclaimer
              developerName={developerName}
              isVerified={isVerified}
            />
          </div>
        </div>
      </div>

      {showCollapseButton && (
        <Button
          variant="secondary"
          size="xl"
          className="h-auto min-h-11 max-w-full whitespace-normal"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? t(`show-less`) : t(`show-more`)}
        </Button>
      )}
    </div>
  )
}
