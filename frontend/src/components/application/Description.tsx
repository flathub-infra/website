import { useCollapse } from "@collapsed/react"
import clsx from "clsx"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "next-i18next"
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
  const { t } = useTranslation()
  const collapsedHeight = 356

  const description = useMemo(
    () =>
      app.description
        ? linkifyHtml(sanitizeAppstreamDescription(app.description), {
            rel: "noopener noreferrer",
            target: "_blank",
          })
        : "",
    [app.description],
  )

  const [scrollHeight, setScrollHeight] = useState(0)

  const ref = useCallback((node) => {
    if (node !== null) {
      setScrollHeight(node.scrollHeight)
    }
  }, [])

  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    collapsedHeight: collapsedHeight,
  })

  return (
    <>
      <div>
        <h2 className="my-4 text-xl font-semibold ">
          {app.summary.length > 35 && isQualityModalOpen ? (
            <>
              <span>{app.summary.slice(0, 35)}</span>
              <mark>{app.summary.slice(35, app.summary.length)}</mark>
            </>
          ) : (
            app.summary
          )}
        </h2>
        {scrollHeight > collapsedHeight && (
          <div
            {...getCollapseProps({ ref })}
            className={clsx(
              `prose relative transition-all dark:prose-invert xl:max-w-[75%]`,
              !isExpanded &&
                scrollHeight > collapsedHeight &&
                "before:from-flathub-lotion before:absolute before:bottom-0 before:start-0 before:h-1/3 before:w-full before:bg-linear-to-t before:content-[''] dark:before:from-flathub-dark-gunmetal",
            )}
            dangerouslySetInnerHTML={{
              __html: description,
            }}
          />
        )}
        {scrollHeight <= collapsedHeight && (
          <div
            className={`prose dark:prose-invert xl:max-w-[75%]`}
            ref={ref}
            dangerouslySetInnerHTML={{
              __html: description,
            }}
          />
        )}
      </div>

      {scrollHeight > collapsedHeight && (
        <button {...getToggleProps()}>
          <span className="m-0 w-full rounded-xl bg-flathub-white px-6 py-2 font-semibold shadow-md transition hover:cursor-pointer hover:bg-flathub-white dark:bg-flathub-arsenic/80 dark:hover:bg-flathub-arsenic">
            {isExpanded ? t(`show-less`) : t(`show-more`)}
          </span>
        </button>
      )}
    </>
  )
}
