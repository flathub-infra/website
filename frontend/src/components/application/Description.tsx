import clsx from "clsx"
import { useMemo, useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { sanitizeAppstreamDescription } from "@/lib/helpers"
import linkifyHtml from "linkify-html"
import { DesktopAppstream } from "src/types/Appstream"

export const Description = ({
  app,
  isQualityModalOpen,
}: {
  app: Pick<DesktopAppstream, "description" | "summary">
  isQualityModalOpen: boolean
}) => {
  const t = useTranslations()
  const collapsedHeight = 356

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
  const [fullHeight, setFullHeight] = useState<number>(0)

  useEffect(() => {
    // Check if content is overflowing after render
    if (contentRef.current) {
      setFullHeight(contentRef.current.scrollHeight)
      setShowCollapseButton(contentRef.current.scrollHeight > collapsedHeight)
    }
  }, [description])

  return (
    <>
      <div>
        <h2 className="my-4 text-xl font-semibold">
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
          ref={contentRef}
          className={clsx(
            "prose relative overflow-hidden transition-all duration-300 ease-in-out dark:prose-invert xl:max-w-[75%]",
            !isExpanded &&
              showCollapseButton &&
              "before:from-flathub-lotion before:absolute before:bottom-0 before:start-0 before:h-1/3 before:w-full before:bg-linear-to-t before:content-[''] dark:before:from-flathub-dark-gunmetal",
          )}
          style={{
            maxHeight:
              isExpanded || !showCollapseButton
                ? fullHeight
                  ? `${fullHeight}px`
                  : "none"
                : `${collapsedHeight}px`,
          }}
          dangerouslySetInnerHTML={{
            __html: description,
          }}
        />
      </div>

      {showCollapseButton && (
        <button onClick={() => setIsExpanded(!isExpanded)}>
          <span className="m-0 w-full rounded-xl bg-flathub-white px-6 py-2 font-semibold shadow-md transition hover:cursor-pointer hover:bg-flathub-white dark:bg-flathub-arsenic/80 dark:hover:bg-flathub-arsenic">
            {isExpanded ? t(`show-less`) : t(`show-more`)}
          </span>
        </button>
      )}
    </>
  )
}
